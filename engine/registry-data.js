// registry-data.js — the found-sound, sample, instrument and percussion registries
//
// GENERATED ONCE by tools/build/split-kernel-data.js, and hand-edited ever since:
// this file is the SOURCE OF TRUTH for the data below, not a build artifact.
// genre-tool.js / invent-genres.js / rm-genre.js splice into it by the same
// /* genre-tool:<name>:genres */ markers they always used.
//
// SOURCES / SOURCE_POOLS / VOICE_FAMILIES / SAMPLES / VOXBANK / SAMPLERS / PERCBANK — the ids the fetch recipes write and the engine resolves.
//
// Classic script on purpose, NOT JSON-over-fetch: app/entries/access.js and
// app/map/starmap.js read the kernel synchronously at module top level, so the data
// has to be present the moment genre-kernel.js runs. Loaded immediately BEFORE
// it in index.html / embed.html / access.html (test/gates/boot-smoke.test.js enforces order).
(function (root) {
  "use strict";
  const D = {};
  D.SOURCES = {
    tokyo_station:{ label:"Tokyo Station",   url:"https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg" },
    highway_night:{ label:"Night Highway",   url:"https://archive.org/download/aporee_44512_50607/soundmap201905198.mp3" },
    factory:      { label:"Metallurgy Plant",url:"https://archive.org/download/aporee_63765_73460/ATA025Antofagastasiderurgiausinacamionesencarretera.mp3" },
    frogs:        { label:"Frog Chorus",     url:"https://archive.org/download/aporee_61056_70186/soundmap202307117.mp3" },   // bird-rarity round: thematically core in newage + crickettempo ONLY
    iriomote:     { label:"Iriomote Island", url:"https://archive.org/download/aporee_30783_35405/iriomoteaporee.ogg" },   // bird-heavy — benched from every genre pool (birds are for canadians); kept for saved states
    shibuya:      { label:"Shibuya Street",  url:"https://archive.org/download/aporee_20542_23865/nov820131617shibuya.ogg" },
    loon:         { label:"Common Loon (USFWS, PD)", url:"https://archive.org/download/CommonLoon/loons.mp3" },   // the loonie's bird — canawave territory ONLY (which whispers SAMPLES ca_loon); in no other genre pool
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
    vx_ginsberg_class:{ label:"Ginsberg — Basic Poetics, Naropa 1980 (class)", url:"https://archive.org/download/Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020/Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020_64kb.mp3" },   // spoken-word lecture — CC BY-NC-ND (Naropa)
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
    // ---- NAROPA POETICS AUDIO ARCHIVE expansion — 25 readings from
    // the Beat / New American Poetry circle at the Jack Kerouac School (collection:
    // naropa). Joins the vx_* voice shelf. Every item is CC BY-NC-ND (the archaic
    // "by-nd-nc/1.0" slug) — TIER 2: fetch-only via tools/fetch/fetch-found-naropa.sh,
    // NON-COMMERCIAL, never redistributed; local url falls back to archive.org.
    // Credit "Naropa Poetics Audio Archive". Ledger: SOURCES.md "Naropa expansion".
    // vx_waldman_crack (ND012) is UNDATED. vx_cage_studio79 = chance
    // phonemes (idm/experimental only, NOT the general voices pool).
    vx_corso_history75: { label:"Gregory Corso — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gregory_Corso_The_history_of_poetry_June_1975_75P002/Gregory_Corso_The_history_of_poetry_June_1975_75P002_64kb.mp3" },
    vx_corso_class77: { label:"Gregory Corso — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gregory_Corso_class_1_July_1977_77P091/Gregory_Corso_class_1_July_1977_77P091_64kb.mp3" },
    vx_corso_workshop81: { label:"Gregory Corso — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gregory_Corso_workshop_1_July_1981_81P081/Gregory_Corso_workshop_1_July_1981_81P081_64kb.mp3" },
    vx_corso_class81: { label:"Gregory Corso — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gregory_Corso_class_1_July_1981_81P083/Gregory_Corso_class_1_July_1981_81P083_64kb.mp3" },
    vx_orlovsky_dumb81: { label:"Peter Orlovsky — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Peter_Orlovsky_Poetry_for_Dumb_Students_June_1981_81P138/Peter_Orlovsky_Poetry_for_Dumb_Students_June_1981_81P138_64kb.mp3" },
    vx_diprima_1987: { label:"Diane di Prima — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Diane_di_Prima_reading_July_1987_87P064/Diane_di_Prima_reading_July_1987_87P064_64kb.mp3" },
    vx_diprima_1994: { label:"Diane di Prima — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/diPrima_Ginsberg_Waldman_reading_July_1994_94P041A/diPrima_Ginsberg_Waldman_reading_July_1994_94P041A_64kb.mp3" },
    vx_kyger_1989: { label:"Joanne Kyger — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Joanne_Kyger_Lorenzo_Thomas_reading_July_1989_89P165/Joanne_Kyger_Lorenzo_Thomas_reading_July_1989_89P165_64kb.mp3" },
    vx_kyger_1993: { label:"Joanne Kyger — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Kyger_Mackey_Corbett_Hollo_reading_July_1993_93P053/Kyger_Mackey_Corbett_Hollo_reading_July_1993_93P053_64kb.mp3" },
    vx_waldman_crack: { label:"Anne Waldman — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Waldman_reading_Crack_in_the_world_ND012/Waldman_reading_Crack_in_the_world_ND012_64kb.mp3" },
    vx_snyder_reading83: { label:"Gary Snyder — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gary_Snyder_reading_August_1983_83P099/Gary_Snyder_reading_August_1983_83P099_64kb.mp3" },
    vx_whalen_reading80: { label:"Philip Whalen — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Reading_with_Whalen_Clausen_Hollow_part_1_July_1980_80p181/Reading_with_Whalen_Clausen_Hollow_part_1_July_1980_80p181_64kb.mp3" },
    vx_whalen_lecture87: { label:"Philip Whalen — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Whalen_lecture_part_3_June_1987_87P047/Whalen_lecture_part_3_June_1987_87P047_64kb.mp3" },
    vx_mcclure_perf99: { label:"Michael McClure — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Michael_McClure_and_Steven_Taylor_perfor_99P035/99P035_64kb.mp3" },
    vx_snyder_songs83: { label:"Gary Snyder — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Gary_Snyder_Book_of_Songs_class_part_1_1983_83p067/Gary_Snyder_Book_of_Songs_class_part_1_1983_83p067_64kb.mp3" },
    vx_cage_studio79: { label:"John Cage — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/John_Cage_studio_performance_January_1979_79P127/John_Cage_studio_performance_January_1979_79P127_64kb.mp3" },
    vx_baraka_ortiz84: { label:"Simon Ortiz / Amiri Baraka — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Simon_Ortiz_Amiri_Baraka_reading_July_1984_84P060/Simon_Ortiz_Amiri_Baraka_reading_July_1984_84P060_64kb.mp3" },
    vx_kupferberg_fugs87: { label:"Tuli Kupferberg / Steven Taylor — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Steven_Taylor_performs_class_on_performa_87P051/87P051_64kb.mp3" },
    vx_baraka_revpoetry94: { label:"Amiri Baraka — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/naropa_amiri_baraka_lecture_on/naropa_amiri_baraka_lecture_on_64kb.mp3" },
    vx_sanders_panel03: { label:"Ed Sanders — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Sanders_Blaser_Sikelianos_Durand_Warshall_Waldman_panel_Alternative_communities_and_writing_June_2003_03P004/Sanders_Blaser_Sikelianos_Durand_Warshall_Waldman_panel_Alternative_communities_and_writing_June_2003_03P004.mp3" },
    vx_ginsberg_mexcityblues: { label:"Allen Ginsberg — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Ginsber_Mexico_City_Blues_July_1988_88P044/Ginsber_Mexico_City_Blues_July_1988_88P044_64kb.mp3" },
    vx_ginsberg_sincerity: { label:"Allen Ginsberg — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/Ginsberg_reading_Sincerity_rap_July_1985_85P017/Ginsberg_reading_Sincerity_rap_July_1985_85P017_64kb.mp3" },
    vx_ginsberg_kerouacconf: { label:"Allen Ginsberg — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/naropa_allen_ginsberg_workshop_jack2/naropa_allen_ginsberg_workshop_jack2_64kb.mp3" },
    vx_burroughs_lecture76: { label:"William S. Burroughs — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/naropa_william_s_burroughs2/naropa_william_s_burroughs2_64kb.mp3" },
    vx_burroughs_giorno79: { label:"William S. Burroughs — Naropa (CC BY-NC-ND)", url:"https://archive.org/download/William_S_Burroughs_Sr_and_John_Giorno_reading_August_1979_79P104/William_S_Burroughs_Sr_and_John_Giorno_reading_August_1979_79P104_64kb.mp3" },
    // the 30-genre commission bed crate (materials round): 13 ambience
    // beds living as local found/<id>.mp3 (no samplePath: the press falls back to
    // found/<id>.mp3, exactly like every SOURCES bed). 8 archive.org fetches (per-
    // item license basis) + 5 synthesized tech elegies. Recovery recipe + exact
    // fetch URLs live in genre-specs/MATERIALS.md and SOURCES.md; url:"" here where
    // the bed is synthesized or awaiting the fetch-found-sound.sh recipe bump.
    whale_song:      { label:"NPS humpback whale song (US-gov PUBLIC DOMAIN)", url:"found/whale_song.64.mp3" },   // whalejazz — trading fours with the humpback (US National Park Service — ledger row in SOURCES.md)
    hydrophone:      { label:"NOAA hydrophone ocean-column ambience (PUBLIC DOMAIN)", url:"found/hydrophone.64.mp3" },   // atlantidrone — the water column
    crickets:        { label:"Snowy tree cricket / katydid night chorus (PD nature)", url:"found/crickets.64.mp3" },   // crickettempo — Dolbear's Law
    ferment_bubble:  { label:"Sourdough starter fermenting (+15dB) — food-bed", url:"found/ferment_bubble.64.mp3" },          // sourdough — a starter is alive
    dw_cycle:        { label:"Dishwasher rinse-pump + heated-dry tick — domestic bed", url:"found/dw_cycle.64.mp3" },   // dishwasherwave
    pigeon_coo:      { label:"Feral pigeon / rock dove coo (CC BY-SA 4.0 — flagged, see SOURCES.md)", url:"found/pigeon_coo.64.mp3" },  // pigeonstep
    chickadee:       { label:"Black-capped chickadee fee-bee song (PD-adjacent, verify)", url:"found/chickadee.64.mp3" },  // chickadeecore — the descending m3
    dryer_spin:      { label:"Tumble-dryer accelerating spin cycle — domestic break bed", url:"found/dryer_spin.64.mp3" }, // laundrycore
    fax_tone:        { label:"Fax CNG/CED tones, synthesized (1100/2100Hz) — license-free", url:"found/fax_tone.64.mp3" },   // faxbossa
    hvac_hum:        { label:"HVAC furnace drone, synthesized room-tone — license-free", url:"found/hvac_hum.64.mp3" },      // thermostatwave
    floppy_seek:     { label:"3.5\" floppy head-stepper seek, synthesized — license-free", url:"found/floppy_seek.64.mp3" },    // floppycore — the break
    modem_handshake: { label:"56k modem handshake negotiation, synthesized — license-free", url:"found/modem_handshake.64.mp3" },   // dialupgabber — the drop (url must be non-empty: an empty url is unfetchable even when the file is on disk)
    crt_whine:       { label:"CRT flyback whine at the true 15734Hz NTSC line, synthesized", url:"found/crt_whine.64.mp3" },   // crtwave — the high drone
    // ---- bed-pool expansion (repertoire wave 3) — 79 radio-aporee beds,
    // ten character classes, fetched by tools/fetch/fetch-bed-expansion.sh. Licenses
    // verified per item (ledger: SOURCES.md "Bed-pool expansion");
    // permissive-only slate: PD Mark / CC BY (⚠ attribution) / CC BY-SA (⚠ SA).
    // city air
    empress_market:      { label:"Empress Market (Karachi)", url:"https://archive.org/download/aporee_33725_38795/EmperessMarketEdited.mp3" },   // PD Mark
    xanthi_bazaar:       { label:"Xanthi Bazaar", url:"https://archive.org/download/aporee_30735_35347/Bigbazaarambience.mp3" },   // CC BY ⚠ attribution
    tunis_souk:          { label:"Tunis Souk", url:"https://archive.org/download/aporee_56148_64205/TunisSoukchant.mp3" },   // PD Mark
    marrakesh_forge:     { label:"Souk Blacksmiths (Marrakesh)", url:"https://archive.org/download/aporee_22317_25900/marrakeshMedinaBlacksmith140226.mp3" },   // CC BY ⚠ attribution
    brighton_arcade:     { label:"Brighton Pier Arcade", url:"https://archive.org/download/aporee_27514_31721/BrightonPierarcade.mp3" },   // PD Mark
    vegas_casino:        { label:"Vegas Casino Floor", url:"https://archive.org/download/aporee_21167_24591/lasvegascasino.mp3" },   // PD Mark
    nyc_subway:          { label:"Times Square Station", url:"https://archive.org/download/aporee_21691_25214/032140215173333.mp3" },   // PD Mark
    bart_last_train:     { label:"Last BART Train", url:"https://archive.org/download/aporee_18542_21525/LastBARTMacArthur.mp3" },   // PD Mark
    budapest_escalator:  { label:"Budapest Metro Escalator", url:"https://archive.org/download/aporee_34266_39393/DeakFerenczTerescelator.mp3" },   // PD Mark
    schoolyard_break:    { label:"Schoolyard Break", url:"https://archive.org/download/aporee_27924_32185/GrundschuleLlsdorf.mp3" },   // PD Mark
    playground_amsterdam:{ label:"Amsterdam Playground", url:"https://archive.org/download/aporee_19823_23031/STE0012KinderspeelplaatsHendrik27092013.mp3" },   // PD Mark
    keelung_fishmarket:  { label:"Keelung Fish Market", url:"https://archive.org/download/aporee_17407_20260/Soundmap2012062452.mp3" },   // CC BY ⚠ attribution
    // road hum
    beitou_night_traffic:{ label:"Night Traffic (Beitou)", url:"https://archive.org/download/aporee_20245_23563/SoundMap201311026.mp3" },   // PD Mark
    morning_traffic_ny:  { label:"Morning Arterial (NY)", url:"https://archive.org/download/aporee_14133_16462/guilderlandtraffic.mp3" },   // PD Mark
    cairo_traffic_jam:   { label:"Cairo Traffic Jam", url:"https://archive.org/download/aporee_13530_15782/alazharstreet.mp3" },   // CC BY ⚠ attribution
    blizzard_freight:    { label:"Freight in a Blizzard", url:"https://archive.org/download/aporee_30574_35173/FreightTrainSnowstorm.mp3" },   // CC BY ⚠ attribution
    snow_highway:        { label:"Highway Under Snow", url:"https://archive.org/download/aporee_30577_35176/I25PedestrianBridgeSnowTREAT.mp3" },   // CC BY ⚠ attribution
    porto_tram:          { label:"Porto Tram Ride", url:"https://archive.org/download/aporee_20129_23437/tramone.mp3" },   // PD Mark
    bratislava_trainyard:{ label:"Night Train Yard (Bratislava)", url:"https://archive.org/download/aporee_48325_54967/201603242133Ruchaposun.mp3" },   // CC BY ⚠ attribution
    // machine room
    coldharbour_mill:    { label:"Spinning Mill (Devon)", url:"https://archive.org/download/aporee_16852_19600/21042009coldharbourmill01.mp3" },   // CC BY-SA ⚠ SA
    litho_press:         { label:"Old Litho Press", url:"https://archive.org/download/aporee_25084_30610/B12h33m27s02oct2014oldprintingpress.mp3" },   // CC BY-SA ⚠ SA
    zaandam_sawmill:     { label:"Wind-Powered Sawmill", url:"https://archive.org/download/aporee_54394_62217/zaandampila.mp3" },   // PD Mark
    hydro_turbine:       { label:"Hydro Dam Turbine", url:"https://archive.org/download/aporee_13260_15495/elektrine.mp3" },   // PD Mark
    wind_turbine_motor:  { label:"Wind Turbine Yaw Motor", url:"https://archive.org/download/aporee_34689_39885/CAPSEoliennemoteurcricket.mp3" },   // PD Mark
    grinding_plant:      { label:"Coal Grinding Plant", url:"https://archive.org/download/aporee_14900_17371/besidegrinder.mp3" },   // PD Mark
    pumping_station:     { label:"Victorian Pumping Station", url:"https://archive.org/download/aporee_47462_53934/FobneyVictorianpumpingstation.mp3" },   // PD Mark
    ice_machine:         { label:"Ice Stadium Machine", url:"https://archive.org/download/aporee_16196_18783/DusseldorfEisstadionEiswagenNeumannb.mp3" },   // PD Mark
    silo_resonance:      { label:"Flour-Mill Silo Drones", url:"https://archive.org/download/aporee_13729_16009/mariborMehlmuehleSilos290512.mp3" },   // CC BY-SA ⚠ SA
    // voices on tape
    pulkovo_pa:          { label:"Airport Announcements (Pulkovo)", url:"https://archive.org/download/aporee_52884_60425/610eBIPETERSBURGairportannouncenemtssoundwalking190904003.mp3" },   // PD Mark
    kaohsiung_pa:        { label:"Station PA (Kaohsiung)", url:"https://archive.org/download/aporee_18791_21802/SoundMap2012032942.mp3" },   // PD Mark
    leeds_terrace:       { label:"Elland Road Terraces", url:"https://archive.org/download/aporee_31056_35699/LeedsUnitedGameSR004BinauraleditedConverted.mp3" },   // PD Mark
    celtic_fans:         { label:"Bloemfontein Celtic Fans", url:"https://archive.org/download/aporee_7691_9439/BloemfonteinCelticSupportersOct2009.mp3" },   // CC BY-SA ⚠ SA
    nevsky_choir:        { label:"Nevsky Monastery Choir", url:"https://archive.org/download/aporee_30388_34974/LordhavemercyAlexanderNevskyMonastery.mp3" },   // CC BY-SA ⚠ SA
    oslo_ferry_pa:       { label:"Ferry Arrival Announcement", url:"https://archive.org/download/aporee_14593_16997/FahrenachOsloAnkunftAnsage.mp3" },   // PD Mark
    // night air
    coyote_prairie:      { label:"Coyote on the Prairie", url:"https://archive.org/download/aporee_38611_44124/215141felixblumeacoyoteishowlingduringthenightinthetallgrassprairieoklahomausa.mp3" },   // PD Mark
    tepoztlan_cricket:   { label:"Tepoztlán Cricket", url:"https://archive.org/download/aporee_43806_49863/GrilloTEP130102T05RxNoise.mp3" },   // PD Mark
    nj_owls:             { label:"Great Horned Owls", url:"https://archive.org/download/aporee_28200_32491/06Track6.mp3" },   // PD Mark
    mugla_cicadas:       { label:"Night Cicadas (Muğla)", url:"https://archive.org/download/aporee_37508_42950/07312306391trim.mp3" },   // PD Mark
    berlin_dawn_fox:     { label:"Dawn Chorus with Fox (Berlin)", url:"https://archive.org/download/aporee_48991_55788/DawnchorusFriedhofColumbiadammedit.mp3" },   // PD Mark — bird-forward: NO general pool (bird-rarity law; dawn/canadian-adjacent wiring only)
    kruger_dawn:         { label:"Kruger Park Dawn", url:"https://archive.org/download/aporee_33795_38875/TsendzeRusticCampsite.mp3" },   // PD Mark — bird-forward: NO general pool (bird-rarity law)
    mull_night:          { label:"Mull Night (Curlew & Heron)", url:"https://archive.org/download/aporee_47362_53818/NightCurlewandHeronwithfirtrees.mp3" },   // PD Mark — bird-forward: NO general pool (bird-rarity law)
    ibis_evening:        { label:"Ibis Evening (Florida)", url:"https://archive.org/download/aporee_19043_22382/IbisEvening.mp3" },   // PD Mark
    // deep water
    swamp_underwater:    { label:"Swamp Hydrophone", url:"https://archive.org/download/aporee_19431_22572/hidrofonasaporee1.mp3" },   // PD Mark
    underwater_mechanica:{ label:"Underwater Mechanica", url:"https://archive.org/download/aporee_23818_27676/underwatermechanika.mp3" },   // PD Mark
    weir_underwater:     { label:"Weir Underwater", url:"https://archive.org/download/aporee_30821_35445/hydropwier.mp3" },   // PD Mark
    glacier_melt:        { label:"Glacier Meltwater Hydrophone", url:"https://archive.org/download/aporee_64980_75062/2407100485frammAporee.mp3" },   // PD Mark
    pebble_surf:         { label:"Pebble-Beach Surf (Corfu)", url:"https://archive.org/download/aporee_13421_15669/11100803edit.mp3" },   // CC BY ⚠ attribution
    winter_surf:         { label:"Glassy Winter Surf", url:"https://archive.org/download/aporee_15707_18266/StrandNov2712.mp3" },   // PD Mark
    night_beach:         { label:"Nocturnal Beach (Scheveningen)", url:"https://archive.org/download/aporee_22007_25563/NocturnalBeachScheveningen.mp3" },   // PD Mark
    sealion_traffic:     { label:"Sea Lions on the Buoy", url:"https://archive.org/download/aporee_69662_81117/sealionsboatsnarrows914.mp3" },   // PD Mark
    // room tone
    office_predawn:      { label:"Office Before Opening", url:"https://archive.org/download/aporee_16161_22114/officee.mp3" },   // PD Mark
    kitchen_fridge:      { label:"Behind the Refrigerator", url:"https://archive.org/download/aporee_13335_15645/lodowa.mp3" },   // PD Mark
    oil_boiler:          { label:"Domestic Oil Boiler", url:"https://archive.org/download/aporee_56425_64543/domesticoilboiler.mp3" },   // PD Mark
    maat_boiler:         { label:"Power-Plant Boiler Room", url:"https://archive.org/download/aporee_64588_74537/1167aBILISBOAMAATelectrictyboilerroom2404201735.mp3" },   // PD Mark
    seedvault_tunnel:    { label:"Seed Vault Tunnel", url:"https://archive.org/download/aporee_9378_11274/seedvaultalarmbeepventfan.mp3" },   // CC BY-SA ⚠ SA
    platform_vent:       { label:"Platform Ventilation Drone", url:"https://archive.org/download/aporee_32401_37255/bremenHbfGleis8Ventilation160605.mp3" },   // CC BY-SA ⚠ SA
    mills_elevator:      { label:"Music-Hall Elevator", url:"https://archive.org/download/aporee_41528_47359/oaklandMillsMusicDepartmentElevator10162018.mp3" },   // PD Mark
    // weather
    krabi_thunder:       { label:"Monsoon Thunder (Krabi)", url:"https://archive.org/download/aporee_41798_47650/RainandthunderinThailandTH181001T01.mp3" },   // PD Mark
    geres_thunder:       { label:"4am Thunderstorm (Gerês)", url:"https://archive.org/download/aporee_41611_47443/THUNDERSTORM.mp3" },   // PD Mark
    queens_thunder:      { label:"Heavy Rain, Distant Thunder", url:"https://archive.org/download/aporee_46275_52573/RainandDistantThunderstorm.mp3" },   // CC BY ⚠ attribution
    istanbul_storm:      { label:"Storm over the Bosphorus", url:"https://archive.org/download/aporee_8182_9955/nahendesgewitter.mp3" },   // CC BY-SA ⚠ SA
    kielce_rain:         { label:"Rain Onset (Kielce)", url:"https://archive.org/download/aporee_19222_22313/STE00255.mp3" },   // PD Mark
    queens_blizzard:     { label:"Blizzard Winds (Queens)", url:"https://archive.org/download/aporee_55553_63498/BlizzardNightRidgewoodQueens.mp3" },   // CC BY ⚠ attribution
    shetland_storm:      { label:"Storm from Indoors (Shetland)", url:"https://archive.org/download/aporee_58995_67701/CarolineSimpsonsHousestorm1.mp3" },   // CC BY-SA ⚠ SA
    lighthouse_storm:    { label:"Lighthouse Storm (Magallanes)", url:"https://archive.org/download/aporee_43160_49192/160319sanisidrolighthouse.mp3" },   // PD Mark
    grenoble_wind:       { label:"The Singing Wind", url:"https://archive.org/download/aporee_30729_35341/ventARLEQUIN.mp3" },   // PD Mark
    // smalltown
    cordes_bells:        { label:"Village Square Bells (Cordes)", url:"https://archive.org/download/aporee_68104_78862/Cordessurcielpigeonglise.mp3" },   // PD Mark
    brugge_bells:        { label:"Bruges Great Bell", url:"https://archive.org/download/aporee_31799_36524/bruggeolv.mp3" },   // CC BY ⚠ attribution
    stjosef_bells:       { label:"7am Bells (Solingen)", url:"https://archive.org/download/aporee_27760_31992/20150421StJosefinOhligs.mp3" },   // PD Mark
    sunday_bell:         { label:"Hand-Rung Sunday Bell", url:"https://archive.org/download/aporee_26388_30478/ChurchBellsJaneiroDeBaixo.mp3" },   // PD Mark
    calgary_noon:        { label:"Carillon in the Stairwell", url:"https://archive.org/download/aporee_30896_35526/NoonBellsintheStairway.mp3" },   // PD Mark
    brocante_bells:      { label:"Brocante Bells (Bourgueil)", url:"https://archive.org/download/aporee_24286_28194/Bourgueilbrocantebells.mp3" },   // PD Mark
    tongluo_market:      { label:"Small-Town Market (Tongluo)", url:"https://archive.org/download/aporee_35408_40667/soundmap201702169.mp3" },   // CC BY ⚠ attribution
    taranto_storm_bells: { label:"Storm and Far Bells (Taranto)", url:"https://archive.org/download/aporee_21030_24432/TramontoneWindRainBellsedit.mp3" },   // PD Mark
    // shortwave
    kintai_shortwave:    { label:"Shortwave Listening (Kintai)", url:"https://archive.org/download/aporee_57712_66065/swinKintai.mp3" },   // PD Mark — anti-phase stereo: fetch takes channel 0 (getbed1)
    wendover_shortwave:  { label:"Wendover Shortwave", url:"https://archive.org/download/aporee_6463_8010/17shortwavewendoverUT.mp3" },   // CC BY-SA ⚠ SA
    bridge_vlf:          { label:"Railway VLF", url:"https://archive.org/download/aporee_62035_71384/UnderBR1railway20231108114318.mp3" },   // CC BY-SA ⚠ SA
    power_em:            { label:"Power-Station Electromagnetics", url:"https://archive.org/download/aporee_39991_45685/antaliepteshespriezor2.mp3" },   // PD Mark
    harbour_interference:{ label:"Harbour Radio Interference", url:"https://archive.org/download/aporee_28537_32885/RadioInterferenceBallsHead.mp3" },   // CC BY-SA ⚠ SA
    // ---- BBC Sound Effects crate — 36 beds curated from
    // sound-effects.bbcrewind.co.uk across the ten pool classes. ALL RemArc
    // licence (personal/educational/research, NON-COMMERCIAL) — tier 2:
    // fetch-only via tools/fetch/fetch-found-bbc.sh, local url (same-origin under
    // COEP; the BBC CDN sends no CORP), never redistributed. Ledger with BBC
    // catalogue ids: SOURCES.md "BBC Sound Effects". 4 chime one-shots from
    // the same crate live in SAMPLES (bbc_lutine_bell &c).
    bbc_petticoat_market_76:{ label:"London street market, 1976 (BBC)", url:"found/bbc_petticoat_market_76.64.mp3" },
    bbc_arcade_85:          { label:"Amusement arcade, 1985 (BBC)", url:"found/bbc_arcade_85.64.mp3" },
    bbc_istanbul_bazaar:    { label:"Istanbul covered bazaar (BBC)", url:"found/bbc_istanbul_bazaar.64.mp3" },
    bbc_termini_platform:   { label:"Rome Termini platform (BBC)", url:"found/bbc_termini_platform.64.mp3" },
    bbc_m1_drone:           { label:"M1 motorway, mid-distant (BBC)", url:"found/bbc_m1_drone.64.mp3" },
    bbc_italian_steam:      { label:"Italian steam train, interior (BBC)", url:"found/bbc_italian_steam.64.mp3" },
    bbc_blackpool_tram:     { label:"Blackpool tram, interior (BBC)", url:"found/bbc_blackpool_tram.64.mp3" },
    bbc_container_engineroom:{ label:"Container-ship engine room (BBC)", url:"found/bbc_container_engineroom.64.mp3" },
    bbc_hand_loom:          { label:"Hand loom weaving (BBC)", url:"found/bbc_hand_loom.64.mp3" },
    bbc_water_mill:         { label:"Water mill, interior (BBC)", url:"found/bbc_water_mill.64.mp3" },
    bbc_centurion_press:    { label:"Centurion printing press (BBC)", url:"found/bbc_centurion_press.64.mp3" },
    bbc_beam_engine:        { label:"Victorian beam engine (BBC)", url:"found/bbc_beam_engine.64.mp3" },
    bbc_concert_hall_murmur:{ label:"Audience murmur, BBC Concert Hall", url:"found/bbc_concert_hall_murmur.64.mp3" },
    bbc_playground_1971:    { label:"Birmingham playground, 1971 (BBC)", url:"found/bbc_playground_1971.64.mp3" },
    bbc_shoshu_chant:       { label:"Nichiren Shoshu evening chant (BBC)", url:"found/bbc_shoshu_chant.64.mp3" },
    bbc_versailles_market:  { label:"Versailles Sunday market (BBC)", url:"found/bbc_versailles_market.64.mp3" },
    bbc_nz_cicada_shimmer:  { label:"Massed cicadas, New Zealand (BBC)", url:"found/bbc_nz_cicada_shimmer.64.mp3" },
    bbc_kakamega_night:     { label:"Kakamega Forest night (BBC NHU)", url:"found/bbc_kakamega_night.64.mp3" },
    bbc_ranomafana_frognight:{ label:"Ranomafana frog night (BBC NHU)", url:"found/bbc_ranomafana_frognight.64.mp3" },
    bbc_berenty_treegroan:  { label:"Groaning tamarinds, Berenty (BBC NHU)", url:"found/bbc_berenty_treegroan.64.mp3" },
    bbc_underwater_river:   { label:"Underwater river (BBC)", url:"found/bbc_underwater_river.64.mp3" },
    bbc_anchor_locker:      { label:"Anchor-locker seawash, Dover ferry (BBC)", url:"found/bbc_anchor_locker.64.mp3" },
    bbc_loch_lapping:       { label:"Loch Broom shore, lapping (BBC)", url:"found/bbc_loch_lapping.64.mp3" },
    bbc_skye_stream:        { label:"Mountain stream, Isle of Skye (BBC)", url:"found/bbc_skye_stream.64.mp3" },
    bbc_clock_room:         { label:"A room full of ticking clocks (BBC)", url:"found/bbc_clock_room.64.mp3" },
    bbc_grandfather_1680:   { label:"Grandfather clock, 1680 (BBC)", url:"found/bbc_grandfather_1680.64.mp3" },
    bbc_fridge_hum:         { label:"Domestic refrigerator hum (BBC)", url:"found/bbc_fridge_hum.64.mp3" },
    bbc_brewery_boiler:     { label:"Boiler room, Courage Brewery (BBC)", url:"found/bbc_brewery_boiler.64.mp3" },
    bbc_wire_song:          { label:"Wind through wires (BBC)", url:"found/bbc_wire_song.64.mp3" },
    bbc_hail_umbrella:      { label:"Hail on an umbrella (BBC)", url:"found/bbc_hail_umbrella.64.mp3" },
    bbc_blizzard_shutters:  { label:"Blizzard, banging shutters (BBC)", url:"found/bbc_blizzard_shutters.64.mp3" },
    bbc_yacht_cabin_gale:   { label:"Gale from a yacht cabin (BBC)", url:"found/bbc_yacht_cabin_gale.64.mp3" },
    bbc_kilndown_peal:      { label:"Village peal of six, Kilndown (BBC)", url:"found/bbc_kilndown_peal.64.mp3" },
    bbc_forge_shoeing:      { label:"Blacksmith shoeing a horse (BBC)", url:"found/bbc_forge_shoeing.64.mp3" },
    bbc_cart_ride:          { label:"Horse and cart, from the cart (BBC)", url:"found/bbc_cart_ride.64.mp3" },
    bbc_perigord_square:    { label:"Village square, Périgord (BBC)", url:"found/bbc_perigord_square.64.mp3" },
  };
  D.SOURCE_POOLS = {
    // wave 3: +79-bed expansion (tools/fetch/fetch-bed-expansion.sh) —
    // 76 join the pools below; the three bird-forward night beds
    // (berlin_dawn_fox / kruger_dawn / mull_night) are registered in SOURCES
    // but join NO general pool (the bird-rarity law: birds are for canadians /
    // dawn-chorus wiring only — like iriomote, benched from every pool).
    // wave 4: +36 BBC Sound Effects beds (tools/fetch/fetch-found-bbc.sh,
    // RemArc — SOURCES.md "BBC Sound Effects"), four per class below plus four
    // chime one-shots in the chime pool. All insect/wind-led on the nature
    // side — the bird-rarity law holds.
    city:     ["tokyo_station","shibuya","tw_stationhall","tw_platform",
               "empress_market","xanthi_bazaar","tunis_souk","marrakesh_forge","brighton_arcade","vegas_casino",
               "nyc_subway","bart_last_train","budapest_escalator","schoolyard_break","playground_amsterdam","keelung_fishmarket",
               "bbc_petticoat_market_76","bbc_arcade_85","bbc_istanbul_bazaar","bbc_termini_platform"],
    road:     ["highway_night","tw_intrain","tw_trains",
               "beitou_night_traffic","morning_traffic_ny","cairo_traffic_jam","blizzard_freight","snow_highway","porto_tram","bratislava_trainyard",
               "bbc_m1_drone","bbc_italian_steam","bbc_blackpool_tram","bbc_container_engineroom"],
    industry: ["factory",
               "coldharbour_mill","litho_press","zaandam_sawmill","hydro_turbine","wind_turbine_motor","grinding_plant","pumping_station","ice_machine","silo_resonance",
               "bbc_hand_loom","bbc_water_mill","bbc_centurion_press","bbc_beam_engine"],
    // vx_apollo benched from the GENERAL pool by the beep audit — the
    // mission-audio bed carries comm tones that cut through bright-genre bed
    // filters. Genres that name it raw (identity law) keep it.
    voices:   ["vx_timelady","vx_wwvh","vx_conet_swedish","vx_conet_poacher",
               "pulkovo_pa","kaohsiung_pa","leeds_terrace","celtic_fans","nevsky_choir","oslo_ferry_pa",
               "bbc_concert_hall_murmur","bbc_playground_1971","bbc_shoshu_chant","bbc_versailles_market",
               // Naropa: SOLO readings only (single voice, no panel/duo) — the
               // curation is texture, not archive completeness. Six more of the
               // 29 join the original four: 4-of-18 put a reading in ~7% of
               // tracks, which is not "spread all over".
               "vx_snyder_reading83","vx_diprima_1987","vx_kyger_1989","vx_orlovsky_dumb81",
               "vx_ginsberg_mexcityblues","vx_ginsberg_sincerity","vx_waldman_crack",
               "vx_corso_history75","vx_burroughs","vx_waldman"],
    nature:   ["frogs","crickets",
               "coyote_prairie","tepoztlan_cricket","nj_owls","mugla_cicadas","ibis_evening",
               "bbc_nz_cicada_shimmer","bbc_kakamega_night","bbc_ranomafana_frognight","bbc_berenty_treegroan"],
    water:    ["hydrophone",
               "swamp_underwater","underwater_mechanica","weir_underwater","glacier_melt","pebble_surf","winter_surf","night_beach","sealion_traffic",
               "bbc_underwater_river","bbc_anchor_locker","bbc_loch_lapping","bbc_skye_stream"],
    room:     ["hvac_hum",
               "office_predawn","kitchen_fridge","oil_boiler","maat_boiler","seedvault_tunnel","platform_vent","mills_elevator",
               "bbc_clock_room","bbc_grandfather_1680","bbc_fridge_hum","bbc_brewery_boiler"],
    // the three NEW classes (wave 3) — all members from the expansion crate
    weather:  ["krabi_thunder","geres_thunder","queens_thunder","istanbul_storm","kielce_rain","queens_blizzard","shetland_storm","lighthouse_storm","grenoble_wind",
               "bbc_wire_song","bbc_hail_umbrella","bbc_blizzard_shutters","bbc_yacht_cabin_gale"],
    smalltown:["cordes_bells","brugge_bells","stjosef_bells","sunday_bell","calgary_noon","brocante_bells","tongluo_market","taranto_storm_bells",
               "bbc_kilndown_peal","bbc_forge_shoeing","bbc_cart_ride","bbc_perigord_square"],
    shortwave:["kintai_shortwave","wendover_shortwave","bridge_vlf","power_em","harbour_interference"],
    // --- one-shot classes (repertoire wave 3) — for hits.sources.
    // Members are SAMPLES ids (fetch-hits-expansion.sh + fetch-found-samples.sh).
    // IDENTITY hits stay raw ids in their anchors: tw_ding is the transit-door /
    // kitchen / gavel signature (microwave, aldente, auctioncore, the
    // transitwave family), the loon is canawave's, ca_horn is the goal horn —
    // none of those anchors take a chime token; tw_ding rides IN the chime pool
    // for everyone else.
    // BEEP AUDIT: FFT of every pool one-shot. vox_b carries a constant 2.97kHz
    // carrier whistle end-to-end, vox_e the same in half its window, vox_c a
    // steady 1.6kHz tone — all three benched from the pool because a constant
    // carrier reads as a beep in every genre that draws a vocal stab (SAMPLES
    // entries stay; a genre may still name them raw). Apollo share 3/5.
    vocal_stab: ["vox_a","vox_d","vox_f","caruso_78","laughs_78"],
    // bbc_electro_gong BENCHED by the same audit: 95% of its energy is one
    // 1163Hz sine — in the global pool it read as a beep in every genre that
    // drew a chime.
    chime:      ["tw_ding","handbell","timer_ding","chime_tub_hi","chime_tub_lo","chime_hand","chime_glock",
                 "bbc_lutine_bell","bbc_tram_bell","bbc_dingdong_door"],
    // horn_stab is SHELLAC-ONLY (era law): bb_horn_a/b are the bigbeat wing's
    // rave-brass identity and stay raw ids in their anchors — mixing them in
    // would flash a rave horn into tango/jazz on unlucky seeds.
    horn_stab:  ["horns_78","horns_ne_78","horns_ll_78"],
    rave_stab:  ["rave_a","rave_b","rave_c","rave_d","hoover_a","hoover_b","stab_organ","stab_saw"],
    perc_hit:   ["perc_timpani","perc_gong","perc_anvil","perc_wood","perc_slap","perc_agogo","perc_cowbell"],
    // --- break classes, BANDED BY BPM (the tempo lock): found role "break"
    // time-stretches by state.bpm/sample.bpm (csd-engine) and constrain() falls
    // back to amen_170 when the drawn source has no bpm — so a break pool is
    // only safe if every member carries bpm AND the band is narrow enough that
    // the stretch stays musical (<~15%). Anchors reference the band that
    // matches their tempo range, exactly as their raw lists already did.
    break_75_95:  ["dl_82_10","dl_89_08","dl_89_09","dl_89_12","stml_loop_81a","stml_loop_82a","stml_loop_85a","stml_loop_86a","stml_loop_89a","stml_loop_89b","stml_loop_92a","stml_loop_94a"],
    break_95_115: ["dl_99_01","dl_99_03","dl_101_04","stml_loop_96a","stml_loop_99a","stml_loop_103a","stml_loop_105a","stml_loop_108a","stml_loop_110a","stml_loop_112a","stml_loop_112b"],
    break_115_135:["dl_120_13","dl_126_02","dl_133_11","stml_loop_115a","stml_loop_117a","stml_loop_117b","stml_loop_120a","stml_loop_126a","stml_loop_129a","stml_loop_129b","stml_loop_133a","stml_loop_133b"],
    break_135_150:["dl_140_06","dl_140_07","stml_loop_136a","stml_loop_140a","stml_loop_144a","stml_loop_148a","stml_loop_148b"],
    break_155_175:["amen_165","amen_170","amen_172","amen_175","stml_loop_157a","stml_loop_157b","stml_loop_161a","stml_loop_167a"],
  };
  // VOICE FAMILIES — declared rotation groups for the repeat governor
  // (csd-engine governVoiceRepeats). The governor normally reads a family out of
  // the id: `vb_junglist_03` -> `vb_junglist`, `sp_st_akiba` -> `sp_st`. A FLAT
  // two-token id has no family in its name, and the `vx_` shelf as a whole is
  // not rotatable (it holds Blake next to the telephone time lady), so an
  // over-repeating flat id was DROPPED where a three-token id would have been
  // substituted. A group listed here is a curated single-register cast whose
  // members ARE interchangeable, so its ids get the substitution instead of the
  // drop. The tag rides into `foundSources.fam` only for listed ids, so every
  // other state is byte-identical.
  D.VOICE_FAMILIES = {
    // the Naropa/Jack Kerouac School readings: one cast, one register (a poet
    // at a microphone in a small room, 1975-2003), safe to swap for each other.
    naropa:["vx_burroughs","vx_ginsberg","vx_waldman","vx_ginsberg_class",
            "vx_corso_history75","vx_corso_class77","vx_corso_workshop81","vx_corso_class81",
            "vx_orlovsky_dumb81","vx_diprima_1987","vx_diprima_1994","vx_kyger_1989","vx_kyger_1993",
            "vx_waldman_crack","vx_snyder_reading83","vx_whalen_reading80","vx_whalen_lecture87",
            "vx_mcclure_perf99","vx_snyder_songs83","vx_cage_studio79","vx_baraka_ortiz84",
            "vx_kupferberg_fugs87","vx_baraka_revpoetry94","vx_sanders_panel03",
            "vx_ginsberg_mexcityblues","vx_ginsberg_sincerity","vx_ginsberg_kerouacconf",
            "vx_burroughs_lecture76","vx_burroughs_giorno79"],
    // ---- the rest of the flat shelves, cast by REGISTER ----------------------
    // Declaring a family IS the curation, so the test each group below has to
    // pass is the one the governor's comment sets: could a listener hear one
    // member where another was written and not notice a change of room? Where
    // the answer is no, the ids stay flat and keep the DROP — a thinner line is
    // a much smaller artefact than the wrong voice. Two properties make this
    // safer than it sounds: substitution only ever picks a sibling THIS STATE
    // already resolved (so a group can never import a voice a genre did not
    // ask for), and an id in no group is untouched, so every state that was not
    // over-repeating is byte-identical.
    //
    // Apollo 11 mission audio, sliced six ways — literally one recording, so
    // this is the safest cast in the registry and by far the largest lever:
    // `pool:vocal_stab` expands to vox_a/vox_d/vox_f and 113 genres draw it, so
    // those three sat together in most of the catalogue with no way to stand in
    // for each other. (vx_apollo is the same mission but is NOT listed: the beep
    // audit benched it from the general pool, and a family is a two-way street —
    // listing it would let the others be replaced BY it.)
    apollo:["vox_a","vox_b","vox_c","vox_d","vox_e","vox_f"],
    // a voice reading the time over a carrier — the telephone speaking clock and
    // the WWVH station announcer. The `voices` pool already lists them side by
    // side, which is the curation made once already.
    timesignal:["vx_timelady","vx_wwvh"],
    // mid-century radio DRAMA narration: Suspense (CBS 1942) and X Minus One
    // (NBC 1956) are the same announcer's-booth register a generation apart.
    otr_drama:["vx_suspense","vx_xminusone"],
    // LibriVox public-domain POETRY: a volunteer reading verse into a home
    // microphone. Blake, Dickinson and Whitman are one another's substitutes in
    // register even though they are not in period.
    pd_poem:["vx_blake","vx_dickinson","vx_whitman"],
    // 1940s American war radio: FDR's fireside chat and the CBS D-Day bulletins.
    // One room, one crisis, one delivery.
    war_radio:["vx_fdr","vx_dday"],
    // ---- the synthesized announcer lines (`sp_` flat ids) --------------------
    // These are all ONE espeak voice at different pitch/speed, so the risk here
    // is never the wrong VOICE — it is the wrong CONTENT for the room. Grouped
    // by what the line is doing, which is why there are four groups and not one:
    // genre pools really do mix these registers (one genre carries "you are here
    // now" beside "rewind. selecta"), and a single `sp` family would license
    // exactly that swap.
    sp_hype:["sp_energy","sp_pressure","sp_rewind","sp_rhythm"],        // dancefloor calls
    sp_machine:["sp_system","sp_nightdrive"],                            // a system reporting itself
    sp_retail:["sp_plaza","sp_shopping"],                                // the shop-floor PA
    sp_calm:["sp_herenow","sp_slowdown"],                                // the meditation tape
  };
  D.SAMPLES = {
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
    sp_plaza:{ file:"speech/plaza.mp3", kind:"speech", synthText:{text:"welcome to the digital plaza",voice:"en-us",pitch:28,speed:118}, durSec:2.4 },
    sp_shopping:{ file:"speech/shopping.mp3", kind:"speech", synthText:{text:"thank you for shopping with us",voice:"en-us",pitch:30,speed:112}, durSec:2.6 },
    sp_system:{ file:"speech/system.mp3", kind:"speech", synthText:{text:"system online",voice:"en-us",pitch:18,speed:105}, durSec:1.2 },
    sp_energy:{ file:"speech/energy.mp3", kind:"speech", synthText:{text:"energy levels rising",voice:"en-us",pitch:22,speed:120}, durSec:1.6 },
    sp_rewind:{ file:"speech/rewind.mp3", kind:"speech", synthText:{text:"rewind. selecta",voice:"en-us",pitch:14,speed:95}, durSec:1.8 },
    sp_pressure:{ file:"speech/pressure.mp3", kind:"speech", synthText:{text:"maximum pressure",voice:"en-us",pitch:16,speed:100}, durSec:1.4 },
    sp_rhythm:{ file:"speech/rhythm.mp3", kind:"speech", synthText:{text:"feel the rhythm inside",voice:"en-us",pitch:35,speed:125}, durSec:1.6 },
    sp_nightdrive:{ file:"speech/nightdrive.mp3", kind:"speech", synthText:{text:"night drive engaged",voice:"en-us",pitch:20,speed:100}, durSec:1.6 },
    sp_herenow:{ file:"speech/herenow.mp3", kind:"speech", synthText:{text:"you are here now",voice:"en-us",pitch:25,speed:85}, durSec:1.7 },
    sp_slowdown:{ file:"speech/slowdown.mp3", kind:"speech", synthText:{text:"slow down. breathe",voice:"en-us",pitch:24,speed:90}, durSec:1.9 },
    // paleontologist narration (dino-synth voiceover, glitched at render)
    sp_paleo_welcome:{ file:"speech/paleo_welcome.mp3",  kind:"speech", synthText:{text:"welcome, to the age of the dinosaurs",voice:"en-us",pitch:30,speed:88}, durSec:2.51 },
    sp_paleo_mesozoic:{ file:"speech/paleo_mesozoic.mp3", kind:"speech", synthText:{text:"the mesozoic era began, two hundred fifty million years ago",voice:"en-us",pitch:24,speed:92}, durSec:8.06 },
    sp_paleo_sauropod:{ file:"speech/paleo_sauropod.mp3", kind:"speech", synthText:{text:"behold the sauropod. the largest creature ever to walk the earth",voice:"en-us",pitch:20,speed:90}, durSec:3.75 },
    sp_paleo_rex:{ file:"speech/paleo_rex.mp3",      kind:"speech", synthText:{text:"in the late cretaceous, the tyrannosaurus ruled",voice:"en-us",pitch:16,speed:86}, durSec:5.84 },
    sp_paleo_bones:{ file:"speech/paleo_bones.mp3",    kind:"speech", synthText:{text:"these bones tell a story, sixty six million years old",voice:"en-us",pitch:26,speed:90}, durSec:7.37 },
    sp_paleo_skies:{ file:"speech/paleo_skies.mp3",    kind:"speech", synthText:{text:"look up. once, these skies belonged to the pterosaurs",voice:"en-us",pitch:34,speed:92}, durSec:3.30 },
    // canawave — Canadian news narration + the loon call
    ca_loon:      { file:"hits/loon.wav",         kind:"hit",    durSec:24.1 },
    sp_ca_news:{ file:"speech/ca_news.mp3",    kind:"speech", synthText:{text:"good evening. coast to coast to coast, this is the national.",voice:"en-ca",pitch:40,speed:98}, durSec:6.11 },
    sp_ca_maple:{ file:"speech/ca_maple.mp3",   kind:"speech", synthText:{text:"the maple harvest is the largest on record.",voice:"en-ca",pitch:42,speed:100}, durSec:4.45 },
    sp_ca_gold:{ file:"speech/ca_gold.mp3",    kind:"speech", synthText:{text:"and Canada takes the gold, in overtime!",voice:"en-ca",pitch:46,speed:104}, durSec:4.89 },
    sp_ca_lights:{ file:"speech/ca_lights.mp3",  kind:"speech", synthText:{text:"the northern lights lit up the territory skies tonight.",voice:"en-ca",pitch:38,speed:98}, durSec:2.81 },
    sp_ca_rockies:{ file:"speech/ca_rockies.mp3", kind:"speech", synthText:{text:"from the rockies to the atlantic, a beautiful day, eh.",voice:"en-ca",pitch:44,speed:100}, durSec:6.02 },
    sp_ca_sorry:{ file:"speech/ca_sorry.mp3",   kind:"speech", synthText:{text:"and that's the news. thank you. and sorry.",voice:"en-ca",pitch:40,speed:96}, durSec:4.40 },
    sp_ca_justwatchme:{ file:"speech/ca_justwatchme.mp3", kind:"speech", synthText:{text:"well. just watch me.",voice:"en-ca",pitch:36,speed:92}, durSec:2.66 },
    sp_ca_cities: { file:"speech/ca_cities.mp3",  kind:"speech", durSec:13.30 },   // rhyming-cities poem (chopped texture)
    // hockey, hockey lore, hockey stuff
    sp_ca_hnic:{ file:"speech/ca_hnic.mp3",     kind:"speech", synthText:{text:"hockey night in canada!",voice:"en-ca",pitch:44,speed:110}, durSec:2.60 },
    sp_ca_cup:{ file:"speech/ca_cup.mp3",      kind:"speech", synthText:{text:"and lord stanley's cup, comes home to canada!",voice:"en-ca",pitch:40,speed:104}, durSec:5.31 },
    sp_ca_topshelf:{ file:"speech/ca_topshelf.mp3", kind:"speech", synthText:{text:"top shelf, where mama hides the cookies!",voice:"en-ca",pitch:48,speed:116}, durSec:4.10 },
    sp_ca_fivehole:{ file:"speech/ca_fivehole.mp3", kind:"speech", synthText:{text:"five hole! oh, what a beauty!",voice:"en-ca",pitch:46,speed:116}, durSec:4.02 },
    sp_ca_gretzky:{ file:"speech/ca_gretzky.mp3",  kind:"speech", synthText:{text:"gretzky, behind the net, he scores!",voice:"en-ca",pitch:42,speed:112}, durSec:4.38 },
    sp_ca_save:{ file:"speech/ca_save.mp3",     kind:"speech", synthText:{text:"glove save! and a beauty!",voice:"en-ca",pitch:50,speed:118}, durSec:3.08 },
    sp_ca_overtime:{ file:"speech/ca_overtime.mp3", kind:"speech", synthText:{text:"overtime. sudden death. the nation holds its breath.",voice:"en-ca",pitch:36,speed:100}, durSec:5.21 },
    sp_ca_hockey:  { file:"speech/ca_he_shoots.mp3",kind:"speech", durSec:3.09 },   // "he shoots, he scores!"
    ca_horn:       { file:"hits/goal_horn.wav",     kind:"hit",    durSec:3.43 },   // NHL goal horn (real)
    horns_78:{ file:"78s/horns_78.wav", kind:"hit", durSec:6 },
    blues_vox_78:{ file:"78s/blues_vox_78.wav", kind:"hit", durSec:6 },
    // transitwave — station-PA train-schedule announcements (espeak, telephone-band) + real train one-shots
    sp_tw_next:      { file:"speech/tw_next.mp3",       kind:"speech", durSec:3.34 },
    sp_tw_arriving:  { file:"speech/tw_arriving.mp3",   kind:"speech", durSec:5.41 },
    sp_tw_standclear:{ file:"speech/tw_standclear.mp3", kind:"speech", durSec:3.71 },   // NYC subway
    sp_tw_express:   { file:"speech/tw_express.mp3",    kind:"speech", durSec:6.51 },
    sp_tw_delay:     { file:"speech/tw_delay.mp3",      kind:"speech", durSec:2.85 },
    sp_tw_gap:       { file:"speech/tw_gap.mp3",        kind:"speech", durSec:4.70 },
    sp_tw_aboard:    { file:"speech/tw_aboard.mp3",     kind:"speech", durSec:4.42 },
    sp_tw_local:     { file:"speech/tw_local.mp3",      kind:"speech", durSec:6.62 },
    sp_tw_terminus:  { file:"speech/tw_terminus.mp3",   kind:"speech", durSec:6.43 },
    sp_tw_tickets:   { file:"speech/tw_tickets.mp3",    kind:"speech", durSec:4.35 },
    sp_tw_schedule:  { file:"speech/tw_schedule.mp3",   kind:"speech", durSec:16.23 },  // the departures litany (chopped texture)
    tw_arrival:      { file:"hits/train_arrival.wav",   kind:"hit",    durSec:8.0 },   // a train pulling into the platform (Nuremberg field rec)
    tw_pass:         { file:"hits/train_pass.wav",      kind:"hit",    durSec:4.0 },   // a train passing (sparse punctuation)
    tw_ding:         { file:"hits/door_ding.wav",       kind:"hit",    durSec:1.6 },   // the transit door "ding ding" two-tone chime (synthesized)
    // world-metro station names worldwide (buried texture, one under every measure — see buildEvents)
    sp_st_admiralty:{ file:"speech/st_admiralty.mp3", kind:"speech", synthText:{text:"Admiralty",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.08 },
    sp_st_akiba:{ file:"speech/st_akiba.mp3", kind:"speech", synthText:{text:"Akihabara",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.22 },
    sp_st_alex:{ file:"speech/st_alex.mp3", kind:"speech", synthText:{text:"Alexanderplatz",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.65 },
    sp_st_arbat:{ file:"speech/st_arbat.mp3", kind:"speech", synthText:{text:"Arbatskaya",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.24 },
    sp_st_astoria:{ file:"speech/st_astoria.mp3", kind:"speech", synthText:{text:"Astoria",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.01 },
    sp_st_atlantic:{ file:"speech/st_atlantic.mp3", kind:"speech", synthText:{text:"Atlantic Avenue",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.55 },
    sp_st_atocha:{ file:"speech/st_atocha.mp3", kind:"speech", synthText:{text:"Atocha",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.95 },
    sp_st_baker:{ file:"speech/st_baker.mp3", kind:"speech", synthText:{text:"Baker Street",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.32 },
    sp_st_bank:{ file:"speech/st_bank.mp3", kind:"speech", synthText:{text:"Bank",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.87 },
    sp_st_bastille:{ file:"speech/st_bastille.mp3", kind:"speech", synthText:{text:"Bastille",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.96 },
    sp_st_bedford:{ file:"speech/st_bedford.mp3", kind:"speech", synthText:{text:"Bedford Avenue",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.47 },
    sp_st_belleville:{ file:"speech/st_belleville.mp3", kind:"speech", synthText:{text:"Belleville",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.97 },
    sp_st_belmont:{ file:"speech/st_belmont.mp3", kind:"speech", synthText:{text:"Belmont",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.01 },
    sp_st_bloor:{ file:"speech/st_bloor.mp3", kind:"speech", synthText:{text:"Bloor Yonge",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.23 },
    sp_st_brixton:{ file:"speech/st_brixton.mp3", kind:"speech", synthText:{text:"Brixton",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.98 },
    sp_st_bugis:{ file:"speech/st_bugis.mp3", kind:"speech", synthText:{text:"Bugis",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.91 },
    sp_st_camden:{ file:"speech/st_camden.mp3", kind:"speech", synthText:{text:"Camden Town",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.41 },
    sp_st_catalunya:{ file:"speech/st_catalunya.mp3", kind:"speech", synthText:{text:"Catalunya",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.16 },
    sp_st_causeway:{ file:"speech/st_causeway.mp3", kind:"speech", synthText:{text:"Causeway Bay",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.39 },
    sp_st_centraal:{ file:"speech/st_centraal.mp3", kind:"speech", synthText:{text:"Centraal",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.06 },
    sp_st_central:{ file:"speech/st_central.mp3", kind:"speech", synthText:{text:"Central",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.99 },
    sp_st_chandni:{ file:"speech/st_chandni.mp3", kind:"speech", synthText:{text:"Chandni Chowk",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.36 },
    sp_st_chatelet:{ file:"speech/st_chatelet.mp3", kind:"speech", synthText:{text:"Chatelet",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.02 },
    sp_st_circular:{ file:"speech/st_circular.mp3", kind:"speech", synthText:{text:"Circular Quay",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.37 },
    sp_st_colosseo:{ file:"speech/st_colosseo.mp3", kind:"speech", synthText:{text:"Colosseo",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.11 },
    sp_st_coney:{ file:"speech/st_coney.mp3", kind:"speech", synthText:{text:"Coney Island",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.24 },
    sp_st_dam:{ file:"speech/st_dam.mp3", kind:"speech", synthText:{text:"Dam Square",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.29 },
    sp_st_dupont:{ file:"speech/st_dupont.mp3", kind:"speech", synthText:{text:"Dupont Circle",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.42 },
    sp_st_embarcadero:{ file:"speech/st_embarcadero.mp3", kind:"speech", synthText:{text:"Embarcadero",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.36 },
    sp_st_fulton:{ file:"speech/st_fulton.mp3", kind:"speech", synthText:{text:"Fulton Street",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.39 },
    sp_st_gangnam:{ file:"speech/st_gangnam.mp3", kind:"speech", synthText:{text:"Gangnam",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.99 },
    sp_st_ginza:{ file:"speech/st_ginza.mp3", kind:"speech", synthText:{text:"Ginza",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.88 },
    sp_st_grand:{ file:"speech/st_grand.mp3", kind:"speech", synthText:{text:"Grand Central",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.37 },
    sp_st_granvia:{ file:"speech/st_granvia.mp3", kind:"speech", synthText:{text:"Gran Via",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.26 },
    sp_st_harvard:{ file:"speech/st_harvard.mp3", kind:"speech", synthText:{text:"Harvard",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.03 },
    sp_st_hbf:{ file:"speech/st_hbf.mp3", kind:"speech", synthText:{text:"Hauptbahnhof",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.41 },
    sp_st_hongdae:{ file:"speech/st_hongdae.mp3", kind:"speech", synthText:{text:"Hongdae",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.97 },
    sp_st_ikebukuro:{ file:"speech/st_ikebukuro.mp3", kind:"speech", synthText:{text:"Ikebukuro",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.33 },
    sp_st_itaewon:{ file:"speech/st_itaewon.mp3", kind:"speech", synthText:{text:"Itaewon",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.90 },
    sp_st_jamsil:{ file:"speech/st_jamsil.mp3", kind:"speech", synthText:{text:"Jamsil",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.98 },
    sp_st_kadikoy:{ file:"speech/st_kadikoy.mp3", kind:"speech", synthText:{text:"Kadikoy",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.11 },
    sp_st_kiev:{ file:"speech/st_kiev.mp3", kind:"speech", synthText:{text:"Kievskaya",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.15 },
    sp_st_kings:{ file:"speech/st_kings.mp3", kind:"speech", synthText:{text:"King's Cross",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.37 },
    sp_st_komso:{ file:"speech/st_komso.mp3", kind:"speech", synthText:{text:"Komsomolskaya",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.43 },
    sp_st_kotti:{ file:"speech/st_kotti.mp3", kind:"speech", synthText:{text:"Kottbusser Tor",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.52 },
    sp_st_lazare:{ file:"speech/st_lazare.mp3", kind:"speech", synthText:{text:"Saint Lazare",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.43 },
    sp_st_liverpool:{ file:"speech/st_liverpool.mp3", kind:"speech", synthText:{text:"Liverpool Street",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.49 },
    sp_st_marien:{ file:"speech/st_marien.mp3", kind:"speech", synthText:{text:"Marienplatz",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.27 },
    sp_st_metrocenter:{ file:"speech/st_metrocenter.mp3", kind:"speech", synthText:{text:"Metro Center",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.39 },
    sp_st_mongkok:{ file:"speech/st_mongkok.mp3", kind:"speech", synthText:{text:"Mong Kok",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.29 },
    sp_st_montpar:{ file:"speech/st_montpar.mp3", kind:"speech", synthText:{text:"Montparnasse",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.26 },
    sp_st_mustek:{ file:"speech/st_mustek.mp3", kind:"speech", synthText:{text:"Mustek",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.98 },
    sp_st_nakano:{ file:"speech/st_nakano.mp3", kind:"speech", synthText:{text:"Nakano",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.01 },
    sp_st_nation:{ file:"speech/st_nation.mp3", kind:"speech", synthText:{text:"Nation",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.97 },
    sp_st_nord:{ file:"speech/st_nord.mp3", kind:"speech", synthText:{text:"Gare du Nord",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.36 },
    sp_st_opera:{ file:"speech/st_opera.mp3", kind:"speech", synthText:{text:"Opera",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.88 },
    sp_st_orchard:{ file:"speech/st_orchard.mp3", kind:"speech", synthText:{text:"Orchard",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.95 },
    sp_st_oxford:{ file:"speech/st_oxford.mp3", kind:"speech", synthText:{text:"Oxford Circus",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.57 },
    sp_st_paddington:{ file:"speech/st_paddington.mp3", kind:"speech", synthText:{text:"Paddington",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.11 },
    sp_st_parkst:{ file:"speech/st_parkst.mp3", kind:"speech", synthText:{text:"Park Street",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.31 },
    sp_st_paulista:{ file:"speech/st_paulista.mp3", kind:"speech", synthText:{text:"Paulista",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.03 },
    sp_st_penn:{ file:"speech/st_penn.mp3", kind:"speech", synthText:{text:"Penn Station",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.34 },
    sp_st_pigalle:{ file:"speech/st_pigalle.mp3", kind:"speech", synthText:{text:"Pigalle",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.87 },
    sp_st_pino:{ file:"speech/st_pino.mp3", kind:"speech", synthText:{text:"Pino Suarez",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.35 },
    sp_st_potsdamer:{ file:"speech/st_potsdamer.mp3", kind:"speech", synthText:{text:"Potsdamer Platz",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.64 },
    sp_st_powell:{ file:"speech/st_powell.mp3", kind:"speech", synthText:{text:"Powell Street",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.33 },
    sp_st_raffles:{ file:"speech/st_raffles.mp3", kind:"speech", synthText:{text:"Raffles Place",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.39 },
    sp_st_rajiv:{ file:"speech/st_rajiv.mp3", kind:"speech", synthText:{text:"Rajiv Chowk",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.30 },
    sp_st_retiro:{ file:"speech/st_retiro.mp3", kind:"speech", synthText:{text:"Retiro",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.98 },
    sp_st_roppongi:{ file:"speech/st_roppongi.mp3", kind:"speech", synthText:{text:"Roppongi",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.07 },
    sp_st_rossio:{ file:"speech/st_rossio.mp3", kind:"speech", synthText:{text:"Rossio",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.01 },
    sp_st_sadat:{ file:"speech/st_sadat.mp3", kind:"speech", synthText:{text:"Sadat",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.96 },
    sp_st_sagrada:{ file:"speech/st_sagrada.mp3", kind:"speech", synthText:{text:"Sagrada Familia",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.55 },
    sp_st_se:{ file:"speech/st_se.mp3", kind:"speech", synthText:{text:"Se",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.77 },
    sp_st_shibuya:{ file:"speech/st_shibuya.mp3", kind:"speech", synthText:{text:"Shibuya",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.02 },
    sp_st_shinagawa:{ file:"speech/st_shinagawa.mp3", kind:"speech", synthText:{text:"Shinagawa",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.13 },
    sp_st_shinjuku:{ file:"speech/st_shinjuku.mp3", kind:"speech", synthText:{text:"Shinjuku",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.14 },
    sp_st_slussen:{ file:"speech/st_slussen.mp3", kind:"speech", synthText:{text:"Slussen",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.95 },
    sp_st_sol:{ file:"speech/st_sol.mp3", kind:"speech", synthText:{text:"Puerta del Sol",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.62 },
    sp_st_spadina:{ file:"speech/st_spadina.mp3", kind:"speech", synthText:{text:"Spadina",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.98 },
    sp_st_stephans:{ file:"speech/st_stephans.mp3", kind:"speech", synthText:{text:"Stephansplatz",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.41 },
    sp_st_taksim:{ file:"speech/st_taksim.mp3", kind:"speech", synthText:{text:"Taksim",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.03 },
    sp_st_tcentralen:{ file:"speech/st_tcentralen.mp3", kind:"speech", synthText:{text:"T Centralen",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.40 },
    sp_st_termini:{ file:"speech/st_termini.mp3", kind:"speech", synthText:{text:"Termini",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.01 },
    sp_st_times:{ file:"speech/st_times.mp3", kind:"speech", synthText:{text:"Times Square",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.48 },
    sp_st_townhall:{ file:"speech/st_townhall.mp3", kind:"speech", synthText:{text:"Town Hall",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.21 },
    sp_st_ueno:{ file:"speech/st_ueno.mp3", kind:"speech", synthText:{text:"Ueno",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:0.89 },
    sp_st_union:{ file:"speech/st_union.mp3", kind:"speech", synthText:{text:"Union Square",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.37 },
    sp_st_victoria:{ file:"speech/st_victoria.mp3", kind:"speech", synthText:{text:"Victoria",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.12 },
    sp_st_warschauer:{ file:"speech/st_warschauer.mp3", kind:"speech", synthText:{text:"Warschauer Strasse",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.54 },
    sp_st_waterloo:{ file:"speech/st_waterloo.mp3", kind:"speech", synthText:{text:"Waterloo",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.00 },
    sp_st_wynyard:{ file:"speech/st_wynyard.mp3", kind:"speech", synthText:{text:"Wynyard",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.02 },
    sp_st_zocalo:{ file:"speech/st_zocalo.mp3", kind:"speech", synthText:{text:"Zocalo",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.07 },
    sp_st_zoo:{ file:"speech/st_zoo.mp3", kind:"speech", synthText:{text:"Zoo Station",voice:"en-us",variant:"f3",pitch:38,speed:148}, durSec:1.26 },
    // hogcore — 24 Harry Potter "<name> is trans" phrases (the full phrase IS the hook)
    // — was: character NAMES (espeak-ng, varied voices = a cast;
    // recipe: fetch-found-samples.sh "hogcore speech" block). THE VOICE IS THE GENRE:
    // scheduled as pitched-up vocal CHOPS (found role) + a rotating name under every
    // bar (stationPool) + one-shot name stabs (hits). See GENRES.hogcore.
    hp_harry:{ file:"speech/hp_harry.mp3", kind:"speech", synthText:{text:"Harry Potter is trans",voice:"en",variant:"m3",pitch:48,speed:150}, durSec:1.76 },
    hp_hermione:{ file:"speech/hp_hermione.mp3", kind:"speech", synthText:{text:"Hermione Granger is trans",voice:"en",variant:"f4",pitch:55,speed:170}, durSec:1.92 },
    hp_ron:{ file:"speech/hp_ron.mp3", kind:"speech", synthText:{text:"Ron Weasley is trans",voice:"en",variant:"m2",pitch:42,speed:145}, durSec:1.86 },
    hp_dumbledore:{ file:"speech/hp_dumbledore.mp3", kind:"speech", synthText:{text:"Albus Dumbledore is trans",voice:"en",variant:"m7",pitch:30,speed:118}, durSec:1.37 },
    hp_snape:{ file:"speech/hp_snape.mp3", kind:"speech", synthText:{text:"Severus Snape is trans",voice:"en",variant:"m1",pitch:18,speed:104}, durSec:1.61 },
    hp_draco:{ file:"speech/hp_draco.mp3", kind:"speech", synthText:{text:"Draco Malfoy is trans",voice:"en",variant:"m4",pitch:58,speed:148}, durSec:2.19 },
    hp_luna:{ file:"speech/hp_luna.mp3", kind:"speech", synthText:{text:"Luna Lovegood is trans",voice:"en",variant:"f2",pitch:62,speed:112}, durSec:1.27 },
    hp_neville:{ file:"speech/hp_neville.mp3", kind:"speech", synthText:{text:"Neville Longbottom is trans",voice:"en",variant:"m6",pitch:50,speed:160}, durSec:1.98 },
    hp_mcgonagall:{ file:"speech/hp_mcgonagall.mp3", kind:"speech", synthText:{text:"Minerva McGonagall is trans",voice:"en",variant:"f5",pitch:46,speed:138}, durSec:2.56 },
    hp_hagrid:{ file:"speech/hp_hagrid.mp3", kind:"speech", synthText:{text:"Rubeus Hagrid is trans",voice:"en",variant:"croak",pitch:22,speed:112}, durSec:1.52 },
    hp_sirius:{ file:"speech/hp_sirius.mp3", kind:"speech", synthText:{text:"Sirius Black is trans",voice:"en",variant:"m5",pitch:36,speed:132}, durSec:2.18 },
    hp_bellatrix:{ file:"speech/hp_bellatrix.mp3", kind:"speech", synthText:{text:"Bellatrix Lestrange is trans",voice:"en",variant:"f1",pitch:70,speed:178}, durSec:2.04 },
    hp_voldemort:{ file:"speech/hp_voldemort.mp3", kind:"speech", synthText:{text:"Voldemort is trans",voice:"en",variant:"whisper",pitch:12,speed:92}, durSec:1.58 },
    hp_ginny:{ file:"speech/hp_ginny.mp3", kind:"speech", synthText:{text:"Ginny Weasley is trans",voice:"en",variant:"f3",pitch:52,speed:152}, durSec:1.79 },
    hp_cho:{ file:"speech/hp_cho.mp3", kind:"speech", synthText:{text:"Cho Chang is trans",voice:"en",variant:"f4",pitch:60,speed:144}, durSec:1.93 },
    hp_cedric:{ file:"speech/hp_cedric.mp3", kind:"speech", synthText:{text:"Cedric Diggory is trans",voice:"en",variant:"m4",pitch:44,speed:142}, durSec:2.25 },
    hp_dobby:{ file:"speech/hp_dobby.mp3", kind:"speech", synthText:{text:"Dobby is trans",voice:"en",variant:"m6",pitch:78,speed:168}, durSec:0.57 },
    hp_hedwig:{ file:"speech/hp_hedwig.mp3", kind:"speech", synthText:{text:"Hedwig is trans",voice:"en",variant:"f5",pitch:74,speed:130}, durSec:0.86 },
    hp_buckbeak:{ file:"speech/hp_buckbeak.mp3", kind:"speech", synthText:{text:"Buckbeak is trans",voice:"en",variant:"croak",pitch:34,speed:120}, durSec:2.07 },
    hp_peeves:{ file:"speech/hp_peeves.mp3", kind:"speech", synthText:{text:"Peeves is trans",voice:"en",variant:"m3",pitch:82,speed:176}, durSec:0.59 },
    hp_nick:{ file:"speech/hp_nick.mp3", kind:"speech", synthText:{text:"Nearly Headless Nick is trans",voice:"en",variant:"m7",pitch:40,speed:126}, durSec:2.61 },
    hp_myrtle:{ file:"speech/hp_myrtle.mp3", kind:"speech", synthText:{text:"Moaning Myrtle is trans",voice:"en",variant:"f1",pitch:66,speed:108}, durSec:1.38 },
    hp_filch:{ file:"speech/hp_filch.mp3", kind:"speech", synthText:{text:"Argus Filch is trans",voice:"en",variant:"croak",pitch:26,speed:118}, durSec:2.47 },
    hp_crookshanks:{ file:"speech/hp_crookshanks.mp3", kind:"speech", synthText:{text:"Crookshanks is trans",voice:"en",variant:"f2",pitch:56,speed:140}, durSec:2.06 },
    // budstep — 16 cannabis strain names, one deadpan synth narrator (en+m3, low+slow);
    // the recited hook under the amen + SLEEP guitar wall (recipe: fetch-found-samples.sh
    // "budstep speech" block). See GENRES.budstep — buried sampleEvents + name-stab hits.
    wd_bluedream:{ file:"speech/wd_bluedream.mp3", kind:"speech", synthText:{text:"Blue Dream",voice:"en",variant:"m3",pitch:28,speed:116}, durSec:0.73 },
    wd_northernlights:{ file:"speech/wd_northernlights.mp3", kind:"speech", synthText:{text:"Northern Lights",voice:"en",variant:"m3",pitch:26,speed:112}, durSec:0.97 },
    wd_purplehaze:{ file:"speech/wd_purplehaze.mp3", kind:"speech", synthText:{text:"Purple Haze",voice:"en",variant:"m3",pitch:30,speed:114}, durSec:0.90 },
    wd_sourdiesel:{ file:"speech/wd_sourdiesel.mp3", kind:"speech", synthText:{text:"Sour Diesel",voice:"en",variant:"m3",pitch:24,speed:110}, durSec:0.92 },
    wd_whitewidow:{ file:"speech/wd_whitewidow.mp3", kind:"speech", synthText:{text:"White Widow",voice:"en",variant:"m3",pitch:28,speed:118}, durSec:0.82 },
    wd_granddaddy:{ file:"speech/wd_granddaddy.mp3", kind:"speech", synthText:{text:"Granddaddy Purple",voice:"en",variant:"m3",pitch:22,speed:108}, durSec:1.05 },
    wd_jackherer:{ file:"speech/wd_jackherer.mp3", kind:"speech", synthText:{text:"Jack Herer",voice:"en",variant:"m3",pitch:30,speed:116}, durSec:0.76 },
    wd_pineapple:{ file:"speech/wd_pineapple.mp3", kind:"speech", synthText:{text:"Pineapple Express",voice:"en",variant:"m3",pitch:26,speed:118}, durSec:1.04 },
    wd_mauiwowie:{ file:"speech/wd_mauiwowie.mp3", kind:"speech", synthText:{text:"Maui Wowie",voice:"en",variant:"m3",pitch:32,speed:120}, durSec:0.79 },
    wd_acapulco:{ file:"speech/wd_acapulco.mp3", kind:"speech", synthText:{text:"Acapulco Gold",voice:"en",variant:"m3",pitch:24,speed:112}, durSec:1.14 },
    wd_durban:{ file:"speech/wd_durban.mp3", kind:"speech", synthText:{text:"Durban Poison",voice:"en",variant:"m3",pitch:28,speed:114}, durSec:0.99 },
    wd_weddingcake:{ file:"speech/wd_weddingcake.mp3", kind:"speech", synthText:{text:"Wedding Cake",voice:"en",variant:"m3",pitch:30,speed:116}, durSec:0.82 },
    wd_zkittlez:{ file:"speech/wd_zkittlez.mp3", kind:"speech", synthText:{text:"Zkittlez",voice:"en",variant:"m3",pitch:26,speed:118}, durSec:0.82 },
    wd_indica:{ file:"speech/wd_indica.mp3", kind:"speech", synthText:{text:"indica",voice:"en",variant:"m3",pitch:20,speed:104}, durSec:0.77 },
    wd_sativa:{ file:"speech/wd_sativa.mp3", kind:"speech", synthText:{text:"sativa",voice:"en",variant:"m3",pitch:34,speed:122}, durSec:0.69 },
    wd_hybrid:{ file:"speech/wd_hybrid.mp3", kind:"speech", synthText:{text:"hybrid",voice:"en",variant:"m3",pitch:28,speed:112}, durSec:0.72 },
    // --- the 30-genre commission crate (materials round): 16 synthesized
    // one-shots — DTMF digits at true telephone freqs, microwave/timer beeps,
    // gavel/handbell, the degauss thump (deterministic ffmpeg lavfi, license-free)
    allen_key:{ file:"hits/allen_key.wav", kind:"hit", durSec:0.26 },
    cam_click:{ file:"hits/cam_click.wav", kind:"hit", durSec:0.09 },
    degauss:{ file:"hits/degauss.wav", kind:"hit", durSec:1.3 },
    dtmf_1:{ file:"hits/dtmf_1.wav", kind:"hit", durSec:0.14 },
    dtmf_2:{ file:"hits/dtmf_2.wav", kind:"hit", durSec:0.14 },
    dtmf_3:{ file:"hits/dtmf_3.wav", kind:"hit", durSec:0.14 },
    dtmf_4:{ file:"hits/dtmf_4.wav", kind:"hit", durSec:0.14 },
    dtmf_5:{ file:"hits/dtmf_5.wav", kind:"hit", durSec:0.14 },
    dtmf_6:{ file:"hits/dtmf_6.wav", kind:"hit", durSec:0.14 },
    dtmf_7:{ file:"hits/dtmf_7.wav", kind:"hit", durSec:0.14 },
    dtmf_8:{ file:"hits/dtmf_8.wav", kind:"hit", durSec:0.14 },
    dtmf_9:{ file:"hits/dtmf_9.wav", kind:"hit", durSec:0.14 },
    gavel:{ file:"hits/gavel.wav", kind:"hit", durSec:0.2 },
    handbell:{ file:"hits/handbell.wav", kind:"hit", durSec:1.6 },
    mw_beep:{ file:"hits/mw_beep.wav", kind:"hit", durSec:0.66 },
    timer_ding:{ file:"hits/timer_ding.wav", kind:"hit", durSec:1.1 },
    // 66 espeak speech lines — the commission cast (hold-music apologies, EULA reader,
    // DMV window calls, elevator floors, survey prompts, auctioneer, umpire, town crier,
    // Zubrovian anthems, lunar-polka toasts, IKEA step narration, thermostat passive-
    // aggression, cereal ads, scoville dares, ATC read-backs). All texts original/parodic.
    sp_atc_1:{ file:"speech/sp_atc_1.mp3", kind:"speech", synthText:{text:"Speedbird two seven heavy, cleared to land runway two seven left, wind two four zero at eight.",voice:"en",variant:"m2",pitch:40,speed:160}, durSec:6.175 },
    sp_atc_2:{ file:"speech/sp_atc_2.mp3", kind:"speech", synthText:{text:"Contact ground, point niner.",voice:"en",variant:"m2",pitch:41,speed:158}, durSec:2.41 },
    sp_atc_3:{ file:"speech/sp_atc_3.mp3", kind:"speech", synthText:{text:"Hold at the outer marker.",voice:"en",variant:"m2",pitch:39,speed:156}, durSec:1.804 },
    sp_atc_4:{ file:"speech/sp_atc_4.mp3", kind:"speech", synthText:{text:"Squawk seven thousand.",voice:"en",variant:"m2",pitch:42,speed:160}, durSec:1.802 },
    sp_atc_5:{ file:"speech/sp_atc_5.mp3", kind:"speech", synthText:{text:"Report established on the localizer.",voice:"en",variant:"m2",pitch:40,speed:158}, durSec:2.412 },
    sp_auction_1:{ file:"speech/sp_auction_1.mp3", kind:"speech", synthText:{text:"do I hear thirty, thirty, thirty five, now forty, forty, who'll give me forty",voice:"en",variant:"m6",pitch:55,speed:280}, durSec:2.993 },
    sp_auction_2:{ file:"speech/sp_auction_2.mp3", kind:"speech", synthText:{text:"SOLD, to the raver in the back.",voice:"en",variant:"m6",pitch:55,speed:200}, durSec:1.718 },
    sp_auction_3:{ file:"speech/sp_auction_3.mp3", kind:"speech", synthText:{text:"twenty two and a half, do I hear twenty five, twenty five, now thirty",voice:"en",variant:"m6",pitch:55,speed:280}, durSec:2.826 },
    sp_cereal_1:{ file:"speech/sp_cereal_1.mp3", kind:"speech", synthText:{text:"They're great, and legally distinct!",voice:"en-us",variant:"f5",pitch:80,speed:185}, durSec:2.161 },
    sp_cereal_2:{ file:"speech/sp_cereal_2.mp3", kind:"speech", synthText:{text:"Part of this complete breakfast.",voice:"en-us",variant:"f5",pitch:82,speed:188}, durSec:1.863 },
    sp_cereal_3:{ file:"speech/sp_cereal_3.mp3", kind:"speech", synthText:{text:"Now, with more crunch!",voice:"en-us",variant:"f5",pitch:84,speed:190}, durSec:1.624 },
    sp_crier_1:{ file:"speech/sp_crier_1.mp3", kind:"speech", synthText:{text:"OYEZ, OYEZ! Hear ye, hear ye!",voice:"en-gb-x-rp",variant:"m3",pitch:30,speed:130}, durSec:3.799 },
    sp_crier_2:{ file:"speech/sp_crier_2.mp3", kind:"speech", synthText:{text:"Be it known throughout the realm.",voice:"en-gb-x-rp",variant:"m3",pitch:30,speed:128}, durSec:2.309 },
    sp_crier_3:{ file:"speech/sp_crier_3.mp3", kind:"speech", synthText:{text:"God save the bass!",voice:"en-gb-x-rp",variant:"m3",pitch:30,speed:126}, durSec:1.903 },
    sp_dmv_1:{ file:"speech/sp_dmv_1.mp3", kind:"speech", synthText:{text:"Now serving number B forty seven, at window four.",voice:"en",variant:"m4",pitch:40,speed:150}, durSec:4.241 },
    sp_dmv_2:{ file:"speech/sp_dmv_2.mp3", kind:"speech", synthText:{text:"Ticket A twelve, please proceed to counter two.",voice:"en",variant:"m4",pitch:42,speed:148}, durSec:3.806 },
    sp_dmv_3:{ file:"speech/sp_dmv_3.mp3", kind:"speech", synthText:{text:"Now serving. C ninety.",voice:"en",variant:"m4",pitch:38,speed:146}, durSec:2.672 },
    sp_dmv_4:{ file:"speech/sp_dmv_4.mp3", kind:"speech", synthText:{text:"Please have your paperwork ready.",voice:"en",variant:"m4",pitch:40,speed:150}, durSec:2.266 },
    sp_dmv_5:{ file:"speech/sp_dmv_5.mp3", kind:"speech", synthText:{text:"forty seven",voice:"en",variant:"m4",pitch:41,speed:150}, durSec:1.393 },
    sp_dmv_6:{ file:"speech/sp_dmv_6.mp3", kind:"speech", synthText:{text:"ninety",voice:"en",variant:"m4",pitch:39,speed:150}, durSec:1.006 },
    sp_dw_done:{ file:"speech/sp_dw_done.mp3", kind:"speech", synthText:{text:"Cycle complete.",voice:"en",variant:"f1",pitch:40,speed:140}, durSec:1.677 },
    sp_eula_1:{ file:"speech/sp_eula_1.mp3", kind:"speech", synthText:{text:"By pressing play you agree to be bound by these terms, which may be updated at any time without notice.",voice:"en",variant:"m2",pitch:35,speed:170}, durSec:5.869 },
    sp_eula_2:{ file:"speech/sp_eula_2.mp3", kind:"speech", synthText:{text:"You waive the right to a jury trial and agree to binding arbitration in a venue of our choosing.",voice:"en",variant:"m2",pitch:35,speed:172}, durSec:5.183 },
    sp_eula_3:{ file:"speech/sp_eula_3.mp3", kind:"speech", synthText:{text:"We may collect, retain, and share your listening data with our partners, and their partners.",voice:"en",variant:"m2",pitch:34,speed:168}, durSec:5.444 },
    sp_fax_nocarrier:{ file:"speech/sp_fax_nocarrier.mp3", kind:"speech", synthText:{text:"No carrier.",voice:"en",variant:"m2",pitch:40,speed:150}, durSec:1.077 },
    sp_flatpack_1:{ file:"speech/sp_flatpack_1.mp3", kind:"speech", synthText:{text:"Björkenhölm.",voice:"sv",pitch:50,speed:140}, durSec:1.389 },
    sp_flatpack_2:{ file:"speech/sp_flatpack_2.mp3", kind:"speech", synthText:{text:"Insert cam lock D, into panel A.",voice:"en",variant:"m5",pitch:50,speed:150}, durSec:2.466 },
    sp_flatpack_3:{ file:"speech/sp_flatpack_3.mp3", kind:"speech", synthText:{text:"Step six, of six.",voice:"en",variant:"m5",pitch:52,speed:148}, durSec:2.1 },
    sp_flatpack_4:{ file:"speech/sp_flatpack_4.mp3", kind:"speech", synthText:{text:"You will need a person you trust.",voice:"en",variant:"m5",pitch:48,speed:146}, durSec:2.235 },
    sp_flatpack_5:{ file:"speech/sp_flatpack_5.mp3", kind:"speech", synthText:{text:"Smörgabylla. Some parts may be left over.",voice:"sv",pitch:50,speed:138}, durSec:3.993 },
    sp_floor_1:{ file:"speech/sp_floor_1.mp3", kind:"speech", synthText:{text:"Going up. Third floor: ladies' outerwear.",voice:"en-us",variant:"f2",pitch:65,speed:160}, durSec:3.499 },
    sp_floor_2:{ file:"speech/sp_floor_2.mp3", kind:"speech", synthText:{text:"Second floor: housewares and gifts.",voice:"en-us",variant:"f2",pitch:66,speed:158}, durSec:2.939 },
    sp_floor_3:{ file:"speech/sp_floor_3.mp3", kind:"speech", synthText:{text:"Doors closing.",voice:"en-us",variant:"f2",pitch:64,speed:162}, durSec:1.309 },
    sp_floor_4:{ file:"speech/sp_floor_4.mp3", kind:"speech", synthText:{text:"Fifth floor: fine china, and the observation deck.",voice:"en-us",variant:"f2",pitch:67,speed:160}, durSec:4.002 },
    sp_floor_5:{ file:"speech/sp_floor_5.mp3", kind:"speech", synthText:{text:"Going down. Lobby level, and the parking garage.",voice:"en-us",variant:"f2",pitch:63,speed:158}, durSec:3.911 },
    sp_floor_6:{ file:"speech/sp_floor_6.mp3", kind:"speech", synthText:{text:"Please watch your step.",voice:"en-us",variant:"f2",pitch:66,speed:164}, durSec:1.658 },
    sp_floppy_save:{ file:"speech/sp_floppy_save.mp3", kind:"speech", synthText:{text:"Saving document. Do not remove the disk.",voice:"en",variant:"m3",pitch:38,speed:140}, durSec:1.86 },
    sp_grace_1:{ file:"speech/sp_grace_1.mp3", kind:"speech", synthText:{text:"For this reheated bounty, and the leftovers of Tuesday, we give humble thanks.",voice:"en",variant:"m3",pitch:45,speed:120}, durSec:3.552 },
    sp_grace_2:{ file:"speech/sp_grace_2.mp3", kind:"speech", synthText:{text:"Ninety seconds, on high. Amen.",voice:"en",variant:"m3",pitch:44,speed:118}, durSec:2.08 },
    sp_hold_1:{ file:"speech/sp_hold_1.mp3", kind:"speech", synthText:{text:"Your call is important to us. Please continue to hold.",voice:"en-us",variant:"f3",pitch:60,speed:150}, durSec:4.176 },
    sp_hold_2:{ file:"speech/sp_hold_2.mp3", kind:"speech", synthText:{text:"Thank you for your patience. A representative will be with you shortly.",voice:"en-us",variant:"f3",pitch:58,speed:148}, durSec:4.61 },
    sp_hold_3:{ file:"speech/sp_hold_3.mp3", kind:"speech", synthText:{text:"Did you know you can find answers to most questions on our website?",voice:"en-us",variant:"f3",pitch:62,speed:152}, durSec:4.408 },
    sp_hold_4:{ file:"speech/sp_hold_4.mp3", kind:"speech", synthText:{text:"You are now caller number twelve in the queue.",voice:"en-us",variant:"f3",pitch:56,speed:146}, durSec:2.868 },
    sp_laundry_1:{ file:"speech/sp_laundry_1.mp3", kind:"speech", synthText:{text:"Tumble dry low.",voice:"en",variant:"f3",pitch:46,speed:150}, durSec:1.471 },
    sp_laundry_2:{ file:"speech/sp_laundry_2.mp3", kind:"speech", synthText:{text:"Do not overload the drum.",voice:"en",variant:"f3",pitch:44,speed:148}, durSec:1.923 },
    sp_luna_1:{ file:"speech/sp_luna_1.mp3", kind:"speech", synthText:{text:"To the colony! To the dome!",voice:"en",variant:"m4",pitch:46,speed:140}, durSec:2.853 },
    sp_luna_2:{ file:"speech/sp_luna_2.mp3", kind:"speech", synthText:{text:"To not going outside, without a suit!",voice:"en",variant:"m4",pitch:44,speed:138}, durSec:3.442 },
    sp_scoville_1:{ file:"speech/sp_scoville_1.mp3", kind:"speech", synthText:{text:"Jalapeño. Eight thousand Scoville.",voice:"en",variant:"m4",pitch:45,speed:160}, durSec:2.858 },
    sp_scoville_2:{ file:"speech/sp_scoville_2.mp3", kind:"speech", synthText:{text:"Habanero. Two hundred thousand.",voice:"en",variant:"m4",pitch:44,speed:162}, durSec:2.841 },
    sp_scoville_3:{ file:"speech/sp_scoville_3.mp3", kind:"speech", synthText:{text:"Ghost pepper. One million.",voice:"en",variant:"m4",pitch:42,speed:158}, durSec:2.241 },
    sp_scoville_4:{ file:"speech/sp_scoville_4.mp3", kind:"speech", synthText:{text:"Are you sure?",voice:"en",variant:"m4",pitch:40,speed:150}, durSec:1.082 },
    sp_scoville_5:{ file:"speech/sp_scoville_5.mp3", kind:"speech", synthText:{text:"Carolina Reaper. Two point two million.",voice:"en",variant:"m4",pitch:38,speed:156}, durSec:3.173 },
    sp_survey_1:{ file:"speech/sp_survey_1.mp3", kind:"speech", synthText:{text:"On a scale of one to ten, how likely are you to recommend us?",voice:"en-us",variant:"f4",pitch:70,speed:175}, durSec:3.705 },
    sp_survey_2:{ file:"speech/sp_survey_2.mp3", kind:"speech", synthText:{text:"Press one to continue in English.",voice:"en-us",variant:"f4",pitch:72,speed:178}, durSec:2.109 },
    sp_survey_3:{ file:"speech/sp_survey_3.mp3", kind:"speech", synthText:{text:"Your feedback helps us serve you better.",voice:"en-us",variant:"f4",pitch:71,speed:174}, durSec:2.424 },
    sp_survey_4:{ file:"speech/sp_survey_4.mp3", kind:"speech", synthText:{text:"Please stay on the line, for a brief survey.",voice:"en-us",variant:"f4",pitch:69,speed:176}, durSec:2.698 },
    sp_therm_1:{ file:"speech/sp_therm_1.mp3", kind:"speech", synthText:{text:"It's fine. I'm fine.",voice:"en",variant:"m1",pitch:42,speed:150}, durSec:2.248 },
    sp_therm_2:{ file:"speech/sp_therm_2.mp3", kind:"speech", synthText:{text:"I set it to sixty eight, for a reason.",voice:"en",variant:"m1",pitch:40,speed:148}, durSec:2.946 },
    sp_therm_3:{ file:"speech/sp_therm_3.mp3", kind:"speech", synthText:{text:"Someone has been touching the thermostat.",voice:"en",variant:"m1",pitch:38,speed:146}, durSec:2.889 },
    sp_ump_1:{ file:"speech/sp_ump_1.mp3", kind:"speech", synthText:{text:"STEE RIKE THREE, you're OUT!",voice:"en",variant:"m7",pitch:35,speed:150}, durSec:2.39 },
    sp_ump_2:{ file:"speech/sp_ump_2.mp3", kind:"speech", synthText:{text:"SAFE!",voice:"en",variant:"m7",pitch:34,speed:148}, durSec:0.894 },
    sp_ump_3:{ file:"speech/sp_ump_3.mp3", kind:"speech", synthText:{text:"Ball four, take your base.",voice:"en",variant:"m7",pitch:36,speed:152}, durSec:2.25 },
    sp_ump_4:{ file:"speech/sp_ump_4.mp3", kind:"speech", synthText:{text:"Play ball!",voice:"en",variant:"m7",pitch:33,speed:150}, durSec:1.187 },
    sp_zubrovia_1:{ file:"speech/sp_zubrovia_1.mp3", kind:"speech", synthText:{text:"Zubróvya, Zubróvya, ho zna vímu tra la!",voice:"en",variant:"m1",pitch:34,speed:112}, durSec:5.419 },
    sp_zubrovia_2:{ file:"speech/sp_zubrovia_2.mp3", kind:"speech", synthText:{text:"Zubróvya, Zubróvya, ho zna vímu tra la!",voice:"en",variant:"m5",pitch:40,speed:110}, durSec:5.557 },
    sp_zubrovia_3:{ file:"speech/sp_zubrovia_3.mp3", kind:"speech", synthText:{text:"Volo dobra, tra la, Zubróvya svo boda!",voice:"en",variant:"f2",pitch:52,speed:108}, durSec:5.767 },
    // --- Skip to My Loops (Fatboy Slim sample CD, archive.org fatboy-slim-skip-to-my-loops) ---
    // 79 generically-named WAVs recovered by tools/fetch/classify-sample-cd.py (pitch/bpm/class).
    // Curated crate below; full manifest at found/samples/stml/manifest.json. LOOPS = funky
    // breakbeats (bpm detected); CHOPS = vocal/funk stabs; HITS = one-shots.
    stml_loop_81a:{ file:"stml/loop_81_53.wav", kind:"break", bpm:81, durSec:7.873 },
    stml_loop_82a:{ file:"stml/loop_82_16.wav", kind:"break", bpm:82, durSec:8.291 },
    stml_loop_85a:{ file:"stml/loop_85_48.wav", kind:"break", bpm:85, durSec:3.817 },
    stml_loop_86a:{ file:"stml/loop_86_38.wav", kind:"break", bpm:86, durSec:4.428 },
    stml_loop_89a:{ file:"stml/loop_89_03.wav", kind:"break", bpm:89, durSec:5.677 },
    stml_loop_89b:{ file:"stml/loop_89_23.wav", kind:"break", bpm:89, durSec:4.98 },
    stml_loop_92a:{ file:"stml/loop_92_43.wav", kind:"break", bpm:92, durSec:2.628 },
    stml_loop_94a:{ file:"stml/loop_94_62.wav", kind:"break", bpm:94, durSec:4.02 },
    stml_loop_96a:{ file:"stml/loop_96_13.wav", kind:"break", bpm:96, durSec:6.889 },
    stml_loop_99a:{ file:"stml/loop_99_69.wav", kind:"break", bpm:99, durSec:4.742 },
    stml_loop_103a:{ file:"stml/loop_103_24.wav", kind:"break", bpm:103, durSec:2.29 },
    stml_loop_105a:{ file:"stml/loop_105_55.wav", kind:"break", bpm:105, durSec:9.162 },
    stml_loop_108a:{ file:"stml/loop_108_40.wav", kind:"break", bpm:108, durSec:4.348 },   // big-beat band
    stml_loop_110a:{ file:"stml/loop_110_04.wav", kind:"break", bpm:110, durSec:6.061 },   // big-beat band
    stml_loop_112a:{ file:"stml/loop_112_06.wav", kind:"break", bpm:112, durSec:3.356 },   // big-beat band
    stml_loop_112b:{ file:"stml/loop_112_28.wav", kind:"break", bpm:112, durSec:8.489 },   // big-beat band
    stml_loop_115a:{ file:"stml/loop_115_37.wav", kind:"break", bpm:115, durSec:4.716 },   // big-beat band
    stml_loop_117a:{ file:"stml/loop_117_39.wav", kind:"break", bpm:117, durSec:4.112 },   // big-beat band
    stml_loop_117b:{ file:"stml/loop_117_71.wav", kind:"break", bpm:117, durSec:4.083 },   // big-beat band
    stml_loop_120a:{ file:"stml/loop_120_64.wav", kind:"break", bpm:120, durSec:4.042 },   // big-beat band
    stml_loop_126a:{ file:"stml/loop_126_46.wav", kind:"break", bpm:126, durSec:3.808 },   // big-beat band
    stml_loop_129a:{ file:"stml/loop_129_45.wav", kind:"break", bpm:129, durSec:7.478 },   // big-beat band
    stml_loop_129b:{ file:"stml/loop_129_10.wav", kind:"break", bpm:129, durSec:3.229 },   // big-beat band
    stml_loop_133a:{ file:"stml/loop_133_65.wav", kind:"break", bpm:133, durSec:5.13 },   // big-beat band
    stml_loop_133b:{ file:"stml/loop_133_67.wav", kind:"break", bpm:133, durSec:4.826 },   // big-beat band
    stml_loop_136a:{ file:"stml/loop_136_11.wav", kind:"break", bpm:136, durSec:2.163 },   // big-beat band
    stml_loop_140a:{ file:"stml/loop_140_57.wav", kind:"break", bpm:140, durSec:2.293 },   // big-beat band
    stml_loop_144a:{ file:"stml/loop_144_07.wav", kind:"break", bpm:144, durSec:3.277 },   // big-beat band
    stml_loop_148a:{ file:"stml/loop_148_09.wav", kind:"break", bpm:148, durSec:6.669 },   // break/jungle end
    stml_loop_148b:{ file:"stml/loop_148_35.wav", kind:"break", bpm:148, durSec:5.202 },   // break/jungle end
    stml_loop_157a:{ file:"stml/loop_157_21.wav", kind:"break", bpm:157, durSec:4.0 },   // break/jungle end
    stml_loop_157b:{ file:"stml/loop_157_63.wav", kind:"break", bpm:157, durSec:4.043 },   // break/jungle end
    stml_loop_161a:{ file:"stml/loop_161_05.wav", kind:"break", bpm:161, durSec:5.159 },   // break/jungle end
    stml_loop_167a:{ file:"stml/loop_167_68.wav", kind:"break", bpm:167, durSec:2.42 },   // break/jungle end
    stml_chop_c4:{ file:"stml/chop_c4_01.wav", kind:"chop", durSec:1.241, note:"C4" },
    stml_chop_a:{ file:"stml/chop_02.wav", kind:"chop", durSec:1.318 },
    stml_chop_b:{ file:"stml/chop_03.wav", kind:"chop", durSec:3.332 },
    stml_chop_c:{ file:"stml/chop_04.wav", kind:"chop", durSec:1.812 },
    stml_chop_d:{ file:"stml/chop_05.wav", kind:"chop", durSec:0.509 },
    stml_hit_01:{ file:"stml/hit_01.wav", kind:"hit", durSec:1.145 },
    stml_hit_b3:{ file:"stml/hit_b3_02.wav", kind:"hit", durSec:1.623, note:"B3" },
    stml_hit_03:{ file:"stml/hit_03.wav", kind:"hit", durSec:1.29 },
    // --- Ax_Grinder power chords (freesound pack 14939, CC BY 3.0 — SOURCES.md
    // attribution row REQUIRED in any distributed render). Drop-D power chords,
    // Jackson Warrior -> Line6 POD XT: open ~10s wall + palm-muted chugs. Fetched
    // by tools/fetch/fetch-guitar-samples.sh (keyless HQ previews). Claimable by the
    // grunge/metal wave (no anchor references them yet — pool for wave 2).
    pc_ds2_open:{ file:"hits/pc_ds2_open.wav", kind:"hit", durSec:10.02, note:"D#2" },
    pc_ds2_pm:  { file:"hits/pc_ds2_pm.wav",   kind:"hit", durSec:0.26,  note:"D#2" },
    pc_ds2_pm2: { file:"hits/pc_ds2_pm2.wav",  kind:"hit", durSec:0.5,   note:"D#2" },
    pc_as2_open:{ file:"hits/pc_as2_open.wav", kind:"hit", durSec:12.49, note:"A#2" },
    // --- REPERTOIRE WAVE 3 (tools/fetch/fetch-hits-expansion.sh) ---
    // the hits+breaks expansion that fills the SOURCE_POOLS one-shot classes;
    // every source license-verified (SOURCES.md): drumloops113 CC BY 2.5,
    // VCSL CC0, pre-1923 78s PD by age, NASA PD, or synthesized in-house.
    // breaks: drumloops113 — author-recorded live/machine funk breaks
    dl_82_10: { file:"breaks/dl_82_10.wav",  kind:"break", bpm:82,  durSec:2.286 },
    dl_89_08: { file:"breaks/dl_89_08.wav",  kind:"break", bpm:89,  durSec:5.333 },
    dl_89_09: { file:"breaks/dl_89_09.wav",  kind:"break", bpm:89,  durSec:5.393 },
    dl_89_12: { file:"breaks/dl_89_12.wav",  kind:"break", bpm:89,  durSec:5.349 },
    dl_99_01: { file:"breaks/dl_99_01.wav",  kind:"break", bpm:99,  durSec:2.4 },
    dl_99_03: { file:"breaks/dl_99_03.wav",  kind:"break", bpm:99,  durSec:2.4 },
    dl_101_04:{ file:"breaks/dl_101_04.wav", kind:"break", bpm:101, durSec:2.4 },
    dl_120_13:{ file:"breaks/dl_120_13.wav", kind:"break", bpm:120, durSec:8.0 },
    dl_126_02:{ file:"breaks/dl_126_02.wav", kind:"break", bpm:126, durSec:2.4 },
    dl_133_11:{ file:"breaks/dl_133_11.wav", kind:"break", bpm:133, durSec:3.692 },
    dl_140_06:{ file:"breaks/dl_140_06.wav", kind:"break", bpm:140, durSec:1.714 },
    dl_140_07:{ file:"breaks/dl_140_07.wav", kind:"break", bpm:140, durSec:3.429 },
    // vocal stabs: three more Apollo capcom lines (NASA PD) + two pre-1923 78s
    vox_d:    { file:"vox/apollo_d.wav", kind:"vox", durSec:3.0 },
    vox_e:    { file:"vox/apollo_e.wav", kind:"vox", durSec:2.6 },
    vox_f:    { file:"vox/apollo_f.wav", kind:"vox", durSec:3.0 },
    caruso_78:{ file:"78s/caruso_78.wav", kind:"hit", durSec:2.8 },   // Tosca climax, 1909 (PD by age)
    laughs_78:{ file:"78s/laughs_78.wav", kind:"hit", durSec:2.5 },   // "Some Laughs", 1920 (PD by age)
    // horn stabs: military-band brass tuttis, pre-1923 78s (PD by age)
    horns_ne_78:{ file:"78s/horns_ne_78.wav", kind:"hit", durSec:3.0 },   // National Emblem, 1922
    horns_ll_78:{ file:"78s/horns_ll_78.wav", kind:"hit", durSec:3.0 },   // Liberty Loan March (Sousa), 1918
    // chimes: VCSL (CC0) struck idiophones
    chime_tub_hi:{ file:"hits/chime_tub_hi.wav", kind:"hit", durSec:6.0, note:"C4" },
    chime_tub_lo:{ file:"hits/chime_tub_lo.wav", kind:"hit", durSec:6.0, note:"E3" },
    chime_hand:  { file:"hits/chime_hand.wav",   kind:"hit", durSec:5.0, note:"A4" },
    chime_glock: { file:"hits/chime_glock.wav",  kind:"hit", durSec:4.0, note:"C6" },
    // BBC Sound Effects chimes (RemArc — fetch-only, tools/fetch/fetch-found-bbc.sh;
    // ledger: SOURCES.md "BBC Sound Effects"). durSec measured post-trim.
    bbc_lutine_bell:  { file:"bbc/lutine_bell.wav",   kind:"hit", durSec:9.7 },    // the Lutine bell, Lloyd's of London
    bbc_electro_gong: { file:"bbc/electro_gong.wav",  kind:"hit", durSec:3.8 },    // BBC-created electronic gong
    bbc_tram_bell:    { file:"bbc/tram_bell.wav",     kind:"hit", durSec:5.6 },    // Blackpool tram stop-bell
    bbc_dingdong_door:{ file:"bbc/dingdong_door.wav", kind:"hit", durSec:6.4 },    // suburban two-note doorbell
    // orchestral percussion one-shots: VCSL (CC0)
    perc_timpani:{ file:"hits/perc_timpani.wav", kind:"hit", durSec:4.0 },
    perc_gong:   { file:"hits/perc_gong.wav",    kind:"hit", durSec:6.0 },
    perc_anvil:  { file:"hits/perc_anvil.wav",   kind:"hit", durSec:1.686 },
    perc_wood:   { file:"hits/perc_wood.wav",    kind:"hit", durSec:0.758 },
    perc_slap:   { file:"hits/perc_slap.wav",    kind:"hit", durSec:1.308 },
    perc_agogo:  { file:"hits/perc_agogo.wav",   kind:"hit", durSec:1.112 },
    perc_cowbell:{ file:"hits/perc_cowbell.wav", kind:"hit", durSec:1.131 },
    // rave stabs: synthesized in-house (license-free — the tw_ding precedent)
    hoover_a:  { file:"hits/hoover_a.wav",   kind:"hit", durSec:1.4 },   // A2 mentasm drop-in
    hoover_b:  { file:"hits/hoover_b.wav",   kind:"hit", durSec:1.1 },   // E3, faster + brighter
    stab_organ:{ file:"hits/stab_organ.wav", kind:"hit", durSec:0.9 },   // M1-ish minor organ chord
    stab_saw:  { file:"hits/stab_saw.wav",   kind:"hit", durSec:1.0 },   // sus4 saw chord stab
  };
  D.VOXBANK = {
    mallsoft_vapor:{n:30,dur:[4.097,3.655,1.88,4.011,3.576,2.638,2.136,2.646,2.745,2.775,3.34,3.647,2.425,2.921,2.721,3.33,2.605,2.848,1.981,2.846,2.72,2.814,3.514,2.877,2.582,3.83,3.281,3.684,3.513,2.412]},
    transit:{n:30,dur:[3.034,2.716,3.593,2.335,2.586,3.014,2.896,3.34,2.121,2.851,2.572,3.166,2.763,2.506,3.405,2.871,3.387,4.352,1.421,3.427,3.018,1.803,3.051,2.36,2.191,3.201,2.757,2.147,3.981,4.002]},
    rave_hardcore:{n:30,dur:[1.836,1.219,2.437,3.036,1.942,2.446,2.398,1.939,1.399,2.361,2.094,2.532,1.421,1.961,2.02,1.716,1.287,0.921,1.481,1.534,2.439,2.015,2.22,1.654,2.301,3.228,1.691,2.921,2.31,2.776]},
    junglist:{n:30,dur:[2.024,2.266,1.198,2.007,3.101,2.676,1.889,2.177,2.772,1.923,1.449,2.266,2.323,2.109,2.079,2.718,1.618,2.388,2.415,1.84,2.408,2.024,1.747,1.824,1.678,2.018,1.658,2.926,3.039,2.358]},
    jazz_blues:{n:30,dur:[3.862,3.518,2.315,3.19,3.137,3.304,2.628,3.736,3.814,3.4,1.45,2.538,1.529,3.494,2.884,2.55,2.537,3.323,2.259,2.614,2.01,4.938,2.409,3.148,3.861,2.672,2.406,2.61,2.207,2.828]},
    classical_chamber:{n:30,dur:[3.742,2.765,3.87,2.937,3.776,2.814,2.643,3.743,3.077,3.696,3.205,3.109,2.999,3.272,2.573,3.425,3.428,3.106,2.623,2.936,2.347,4.42,2.505,3.585,3.331,2.58,2.544,2.555,2.492,3.169]},
    folk_pastoral:{n:30,dur:[3.338,2.573,3.946,2.713,3.313,2.859,3.331,3.502,3.548,2.318,2.999,3.486,3.001,2.799,3.411,3.468,2.855,2.48,2.585,3.154,2.455,3.166,3.526,2.954,3.603,2.82,3.436,3.714,1.837,3.69]},
    maritime_weather:{n:30,dur:[2.414,3.884,3.615,3.222,2.869,2.973,4.219,2.42,3.007,2.526,3.957,3.163,2.822,4.227,3.351,2.031,3.781,3.29,3.843,2.684,4.705,3.186,2.674,2.662,2.398,2.194,2.835,3.089,1.955,3.654]},
    cosmic_space:{n:30,dur:[3.202,3.122,4.4,4.399,2.875,4.732,2.89,3.88,2.675,3.42,4.741,2.522,4.019,3.202,3.916,3.323,2.683,2.153,3.243,3.623,2.69,3.325,3.195,2.857,2.674,2.95,2.364,3.79,2.041,3.78]},
    domestic_appliance:{n:30,dur:[3.077,3.822,2.754,2.539,3.728,3.807,2.186,2.932,3.346,2.825,3.848,3.758,3.607,4.335,3.17,2.327,2.705,3.853,2.605,3.729,2.652,3.028,3.043,3.642,3.71,3.168,3.312,2.174,2.864,3.179]},
    industrial_machine:{n:30,dur:[2.593,2.44,3.255,2.167,1.481,3.486,2.543,2.062,2.916,3.085,1.803,3.285,2.237,2.195,3.245,2.294,2.459,1.643,1.511,3.213,2.491,3.47,2.839,3.172,3.471,2.388,2.65,2.716,2.022,3.63]},
    spoken_poetic:{n:30,dur:[4.626,2.386,3.26,3.583,1.382,2.929,4.491,2.696,2.673,3.77,3.266,2.114,2.428,4.379,2.884,2.383,2.905,3.43,2.509,3.22,2.7,2.975,2.699,2.791,2.722,3.16,2.123,3.184,2.788,3.012]},
  };
  D.SAMPLERS = {
    // the blues batch (the "truly acoustic" pass): upright bass for the
    // BASS voice, real organs for comping pads. (GM 16 "DrawbarOrgan" was
    // rejected: FluidR3 gives it ONE zone rooted at C7 — chords would pitch
    // down 3-4 octaves into mud. Percussive Organ is the blues B3 anyway.)
    acoustic_bass: { label:"Acoustic Bass (FluidR3, MIT)", dir:"acoustic_bass", sr:44100, zones:[{file:"z00_r28.wav",root:28,lo:0,hi:28,loop:1,ls:76560,le:78701},{file:"z01_r36.wav",root:36,lo:30,hi:36,loop:1,ls:51742,le:52417},{file:"z02_r46.wav",root:46,lo:42,hi:46,loop:1,ls:43947,le:44705},{file:"z03_r54.wav",root:54,lo:47,hi:50,loop:1,ls:36227,le:36704},{file:"z04_r60.wav",root:60,lo:55,hi:60,loop:1,ls:42151,le:42657},{file:"z05_r72.wav",root:72,lo:67,hi:127,loop:1,ls:24106,le:24696}] },
    percussive_organ: { label:"Percussive Organ (FluidR3, MIT)", dir:"percussive_organ", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:39,loop:0,ls:31226,le:100902},{file:"z01_r49.wav",root:49,lo:49,hi:49,loop:1,ls:19729,le:83951},{file:"z02_r56.wav",root:56,lo:55,hi:56,loop:1,ls:46308,le:114633},{file:"z03_r63.wav",root:63,lo:63,hi:65,loop:1,ls:16220,le:78232},{file:"z04_r80.wav",root:80,lo:77,hi:80,loop:1,ls:37396,le:99327},{file:"z05_r91.wav",root:91,lo:90,hi:108,loop:1,ls:33792,le:93185}] },
    rock_organ: { label:"Rock Organ (FluidR3, MIT)", dir:"rock_organ", sr:44100, zones:[{file:"z00_r44.wav",root:44,lo:0,hi:44,loop:1,ls:32179,le:99235},{file:"z01_r52.wav",root:52,lo:50,hi:52,loop:1,ls:65063,le:134049},{file:"z02_r60.wav",root:60,lo:59,hi:60,loop:1,ls:91800,le:164759},{file:"z03_r73.wav",root:73,lo:71,hi:73,loop:1,ls:64627,le:130198},{file:"z04_r81.wav",root:81,lo:80,hi:82,loop:1,ls:110122,le:237739},{file:"z05_r91.wav",root:91,lo:90,hi:108,loop:1,ls:16963,le:83958}] },
    bandoneon:{ label:"Bandoneon (FluidR3, MIT)", dir:"bandoneon", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:60,loop:1,ls:16175,le:16849},{file:"z01_r66.wav",root:66.147,lo:61,hi:66,loop:1,ls:87376,le:282128},{file:"z02_r72.wav",root:72.142,lo:67,hi:72,loop:1,ls:70740,le:199184},{file:"z03_r78.wav",root:78.14,lo:73,hi:78,loop:1,ls:47466,le:143928},{file:"z04_r84.wav",root:84,lo:79,hi:84,loop:1,ls:15786,le:118880},{file:"z05_r90.wav",root:90,lo:85,hi:108,loop:1,ls:6830,le:49586}] },
    alto_sax: { label:"Alto Sax (FluidR3, MIT)", dir:"alto_sax", sr:44100, zones:[{file:"z00_r50.wav",root:49.75,lo:0,hi:51,loop:1,ls:20457,le:31130},{file:"z01_r56.wav",root:55.73,lo:56,hi:57,loop:1,ls:28825,le:38746},{file:"z02_r62.wav",root:61.68,lo:62,hi:63,loop:1,ls:28129,le:37918},{file:"z03_r68.wav",root:67.96,lo:68,hi:69,loop:1,ls:16586,le:26612},{file:"z04_r74.wav",root:73.92,lo:74,hi:75,loop:1,ls:21234,le:30669},{file:"z05_r80.wav",root:79.77,lo:80,hi:84,loop:1,ls:23480,le:32593}] },
    clarinet: { label:"Clarinet (FluidR3, MIT)", dir:"clarinet", sr:44100, zones:[{file:"z00_r52.wav",root:52.04,lo:0,hi:53,loop:1,ls:26055,le:27123},{file:"z01_r61.wav",root:61.13,lo:60,hi:62,loop:1,ls:14071,le:14387},{file:"z02_r68.wav",root:68.01,lo:66,hi:68,loop:1,ls:9362,le:10105},{file:"z03_r74.wav",root:74.16,lo:73,hi:74,loop:1,ls:5866,le:6238},{file:"z04_r78.wav",root:77.89,lo:77,hi:78,loop:1,ls:1943,le:2003},{file:"z05_r84.wav",root:83.96,lo:83,hi:127,loop:1,ls:3631,le:3800}] },
    flute: { label:"Flute (FluidR3, MIT)", dir:"flute", sr:44100, zones:[{file:"z00_r61.wav",root:61,lo:0,hi:62,loop:1,ls:29084,le:40192},{file:"z01_r67.wav",root:67,lo:66,hi:68,loop:1,ls:28411,le:38401},{file:"z02_r71.wav",root:70.98,lo:69,hi:71,loop:1,ls:16790,le:27137},{file:"z03_r78.wav",root:78.11,lo:76,hi:78,loop:1,ls:19435,le:29952},{file:"z04_r80.wav",root:80.258,lo:79,hi:81,loop:1,ls:11271,le:22016},{file:"z05_r90.wav",root:90.32,lo:85,hi:127,loop:1,ls:18767,le:29952}] },
    nylon_string_guitar: { label:"Nylon String Guitar (FluidR3, MIT)", dir:"nylon_string_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.05,lo:0,hi:43,loop:1,ls:192810,le:193345},{file:"z01_r50.wav",root:50,lo:49,hi:53,loop:1,ls:198834,le:200036},{file:"z02_r59.wav",root:59.03,lo:59,hi:62,loop:1,ls:62185,le:62542},{file:"z03_r64.wav",root:63.98,lo:63,hi:67,loop:1,ls:39342,le:39879},{file:"z04_r71.wav",root:71.1,lo:71,hi:75,loop:1,ls:26621,le:27065},{file:"z05_r84.wav",root:84.13,lo:84,hi:127,loop:1,ls:19524,le:19817}] },
    steel_string_guitar: { label:"Steel String Guitar (FluidR3, MIT)", dir:"steel_string_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:39.95,lo:0,hi:43,loop:1,ls:218317,le:220476},{file:"z01_r50.wav",root:49.99,lo:49,hi:53,loop:1,ls:186167,le:187369},{file:"z02_r59.wav",root:59,lo:59,hi:62,loop:1,ls:117803,le:118518},{file:"z03_r64.wav",root:64.03,lo:63,hi:67,loop:1,ls:64535,le:65604},{file:"z04_r71.wav",root:71.04,lo:71,hi:75,loop:1,ls:70810,le:71791},{file:"z05_r84.wav",root:84.13,lo:84,hi:127,loop:1,ls:19524,le:19817}] },
    strings: { label:"Strings (FluidR3, MIT)", dir:"strings", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:56826,le:150523},{file:"z01_r40.wav",root:39.831,lo:38,hi:40,loop:1,ls:54138,le:140576},{file:"z02_r49.wav",root:49,lo:48,hi:51,loop:1,ls:75259,le:139523},{file:"z03_r64.wav",root:64.129,lo:63,hi:65,loop:1,ls:61102,le:159259},{file:"z04_r73.wav",root:73,lo:72,hi:74,loop:1,ls:14601,le:57396},{file:"z05_r83.wav",root:83,lo:82,hi:96,loop:1,ls:27892,le:59980}] },
    // INSTRUMENT-LIBRARY UPGRADE: FreePats Tenor Saxophone (CC0 1.0;
    // VCSL samples re-edited with infinite sustain loops by roberto@zenvoid.org).
    // 8 zones, ALL looped — real reed breath that holds under a solo note. Same id,
    // so every bebop/jazz/whalejazz anchor picks it up with zero edits. Fetched by
    // tools/fetch/fetch-guitar-samples.sh (which replaces the FluidR3 GM extract).
    // tenor_sax dir RENAMED tenor_sax -> tenor_sax_fp (deploy immutability law: replacement zones must not change files under old names — clients cache found/ forever; the FluidR3 originals stay deployed under the old dir)
    tenor_sax: { label:"Tenor Sax (FreePats/VCSL, CC0)", dir:"tenor_sax_fp", sr:44100, zones:[{file:"z00_r44.wav",root:44,lo:0,hi:45,loop:1,ls:52296,le:270193},{file:"z01_r50.wav",root:50,lo:50,hi:51,loop:1,ls:78429,le:300053},{file:"z02_r56.wav",root:56,lo:56,hi:57,loop:1,ls:226197,le:413085},{file:"z03_r62.wav",root:62,lo:62,hi:63,loop:1,ls:40301,le:247709},{file:"z04_r70.wav",root:70,lo:70,hi:71,loop:1,ls:36429,le:296771},{file:"z05_r76.wav",root:76,lo:76,hi:77,loop:1,ls:46254,le:293483},{file:"z06_r82.wav",root:82,lo:82,hi:83,loop:1,ls:20619,le:241538},{file:"z07_r88.wav",root:88,lo:88,hi:127,loop:1,ls:27924,le:179881}] },
    // INSTRUMENT-LIBRARY UPGRADE — the crunch tier: FreePats FSBS
    // Electric Guitar (CC0 1.0; a real Fender, bridge pickups, re-amped). New ids —
    // the GM overdrive_guitar/distortion_guitar dirs STAY for genres that want
    // polite. Unlooped natural decays trimmed to 8s+fade at fetch (precache weight);
    // measured dist2 A2: rms -11.6dB crest 11.6dB (vs GM overdrive crest 14.7 —
    // sustained grind, not decay). di_guitar is the raw pickup signal (-27dB RMS by
    // design): ONLY claim it behind an insert_higain staged amp — the real amp chain.
    // ---- the rest of the melodic bank ------------------------------------
    // 134 GM presets were extracted; 108 were registered, so 26 real instruments
    // sat on disk that no genre could ever ask for. These 15 are the ones that
    // are INSTRUMENTS: the pad shelf's missing atmospheres (warm/halo/metal pad,
    // polysynth, soundtrack, brightness), a shakuhachi, a taiko, tuned
    // percussion (woodblock, melodic tom, agogo) and the leads GM keeps in its
    // synth bank (calliope, bottle chiff, whistle, drawbar organ). The other 11
    // are GM's SOUND-EFFECTS bank — applause, gun shot, helicopter, telephone,
    // bird tweet, sea shore's siblings, fret/breath noise, reverse cymbal — which
    // are not instruments and are deliberately still unregistered, plus a GM
    // tenor_sax the FreePats one already beats. Zone metadata is verbatim
    // extractor output (faust/build/extract-gm.js zones.json).
    shakuhachi: { label:"Shakuhachi (FluidR3, MIT)", dir:"shakuhachi", sr:44100, zones:[{file:"z00_r72.wav",root:72,lo:0,hi:127,loop:1,ls:31772,le:69493}] },
    warm_pad: { label:"Warm Pad (FluidR3, MIT)", dir:"warm_pad", sr:44100, zones:[{file:"z00_r84.wav",root:84,lo:0,hi:108,loop:1,ls:36638,le:51214}] },
    halo_pad: { label:"Halo Pad (FluidR3, MIT)", dir:"halo_pad", sr:44100, zones:[{file:"z00_r84.wav",root:84.169,lo:0,hi:127,loop:1,ls:19277,le:45867}] },
    metal_pad: { label:"Metal Pad (FluidR3, MIT)", dir:"metal_pad", sr:44100, zones:[{file:"z00_r84.wav",root:84,lo:0,hi:108,loop:1,ls:37282,le:73229}] },
    polysynth: { label:"Polysynth (FluidR3, MIT)", dir:"polysynth", sr:44100, zones:[{file:"z00_r84.wav",root:84.169,lo:0,hi:127,loop:1,ls:19277,le:45867}] },
    soundtrack: { label:"Soundtrack (FluidR3, MIT)", dir:"soundtrack", sr:44100, zones:[{file:"z00_r84.wav",root:84,lo:0,hi:108,loop:1,ls:36638,le:51214}] },
    taiko_drum: { label:"Taiko Drum (FluidR3, MIT)", dir:"taiko_drum", sr:44100, zones:[{file:"z00_r60.wav",root:60,lo:0,hi:127,loop:0,ls:8,le:44792}] },
    woodblock: { label:"Woodblock (FluidR3, MIT)", dir:"woodblock", sr:44100, zones:[{file:"z00_r60.wav",root:60,lo:0,hi:127,loop:0,ls:8,le:13368}] },
    brightness: { label:"Brightness (FluidR3, MIT)", dir:"brightness", sr:44100, zones:[{file:"z00_r84.wav",root:84,lo:0,hi:127,loop:1,ls:68964,le:94892}] },
    bottle_chiff: { label:"Bottle Chiff (FluidR3, MIT)", dir:"bottle_chiff", sr:44100, zones:[{file:"z00_r84.wav",root:84.225,lo:0,hi:127,loop:1,ls:8008,le:26234}] },
    calliope_lead: { label:"Calliope Lead (FluidR3, MIT)", dir:"calliope_lead", sr:44100, zones:[{file:"z00_r84.wav",root:84,lo:0,hi:108,loop:1,ls:24827,le:63742}] },
    whistle: { label:"Whistle (FluidR3, MIT)", dir:"whistle", sr:44100, zones:[{file:"z00_r96.wav",root:96,lo:0,hi:127,loop:1,ls:16015,le:16434}] },
    drawbarorgan: { label:"Drawbar Organ (FluidR3, MIT)", dir:"drawbarorgan", sr:44100, zones:[{file:"z00_r72.wav",root:96,lo:0,hi:127,loop:1,ls:15569,le:67826}] },
    melodic_tom: { label:"Melodic Tom (FluidR3, MIT)", dir:"melodic_tom", sr:44100, zones:[{file:"z00_r52.wav",root:53.23,lo:0,hi:127,loop:0,ls:8,le:44265}] },
    agogo: { label:"Agogo (FluidR3, MIT)", dir:"agogo", sr:44100, zones:[{file:"z00_r78.wav",root:78,lo:0,hi:108,loop:0,ls:8,le:12387}] },
    crunch_guitar: { label:"Crunch Guitar (FreePats FSBS dist2, CC0)", dir:"crunch_guitar", sr:44100, zones:[{file:"z00_r36.wav",root:36,lo:0,hi:38,loop:0,ls:0,le:0},{file:"z01_r45.wav",root:44.778,lo:43,hi:46,loop:0,ls:0,le:0},{file:"z02_r50.wav",root:50,lo:50,hi:51,loop:0,ls:0,le:0},{file:"z03_r59.wav",root:59,lo:57,hi:59,loop:0,ls:0,le:0},{file:"z04_r64.wav",root:64,lo:63,hi:65,loop:0,ls:0,le:0},{file:"z05_r72.wav",root:72,lo:72,hi:72,loop:0,ls:0,le:0},{file:"z06_r77.wav",root:77,lo:76,hi:78,loop:0,ls:0,le:0},{file:"z07_r85.wav",root:85,lo:84,hi:127,loop:0,ls:0,le:0}] },
    di_guitar: { label:"DI Electric Guitar (FreePats FSBS direct, CC0)", dir:"di_guitar", sr:44100, zones:[{file:"z00_r36.wav",root:36,lo:0,hi:38,loop:0,ls:0,le:0},{file:"z01_r45.wav",root:44.81,lo:43,hi:46,loop:0,ls:0,le:0},{file:"z02_r50.wav",root:50,lo:50,hi:51,loop:0,ls:0,le:0},{file:"z03_r59.wav",root:59,lo:57,hi:59,loop:0,ls:0,le:0},{file:"z04_r64.wav",root:64,lo:63,hi:65,loop:0,ls:0,le:0},{file:"z05_r72.wav",root:72,lo:72,hi:72,loop:0,ls:0,le:0},{file:"z06_r77.wav",root:77,lo:76,hi:78,loop:0,ls:0,le:0},{file:"z07_r85.wav",root:85,lo:84,hi:127,loop:0,ls:0,le:0}] },
    // FreePats Upright Piano KW (CC0 1.0; a Kawai upright in a living room, 2017) —
    // the intimate/domestic piano voice, NEW id (the GM grand + felt_piano stay).
    // Full 21-108 span, bass-note sustain loops, top octaves natural decay.
    upright_piano: { label:"Upright Piano (FreePats KW, CC0)", dir:"upright_piano", sr:44100, zones:[{file:"z00_r21.wav",root:21,lo:0,hi:22,loop:1,ls:244730,le:333808},{file:"z01_r33.wav",root:33,lo:23,hi:34,loop:1,ls:348550,le:524031},{file:"z02_r39.wav",root:38.83,lo:35,hi:40,loop:1,ls:425067,le:585179},{file:"z03_r48.wav",root:48,lo:41,hi:49,loop:1,ls:196763,le:307070},{file:"z04_r60.wav",root:60,lo:50,hi:61,loop:1,ls:199374,le:354248},{file:"z05_r71.wav",root:71,lo:62,hi:71,loop:0,ls:8,le:151064},{file:"z06_r81.wav",root:81,lo:72,hi:81,loop:0,ls:8,le:125201},{file:"z07_r93.wav",root:93,lo:82,hi:94,loop:0,ls:8,le:35501},{file:"z08_r99.wav",root:99,lo:95,hi:100,loop:0,ls:8,le:34890},{file:"z09_r108.wav",root:108,lo:101,hi:127,loop:0,ls:8,le:30608}] },
    trumpet: { label:"Trumpet (FluidR3, MIT)", dir:"trumpet", sr:44100, zones:[{file:"z00_r60.wav",root:64,lo:0,hi:66,loop:1,ls:7185,le:18296},{file:"z01_r60.wav",root:67,lo:67,hi:71,loop:1,ls:8026,le:16794},{file:"z02_r60.wav",root:72,lo:72,hi:75,loop:1,ls:14270,le:23202},{file:"z03_r60.wav",root:79,lo:76,hi:83,loop:1,ls:10629,le:19860},{file:"z04_r60.wav",root:88,lo:84,hi:90,loop:1,ls:11853,le:18555},{file:"z05_r60.wav",root:96,lo:91,hi:108,loop:1,ls:9248,le:18910}] },
    vibraphone: { label:"Vibraphone (FluidR3, MIT)", dir:"vibraphone", sr:44100, zones:[{file:"z00_r57.wav",root:57,lo:0,hi:57,loop:1,ls:14677,le:17684},{file:"z01_r66.wav",root:66,lo:64,hi:66,loop:1,ls:9361,le:9600},{file:"z02_r81.wav",root:81,lo:79,hi:81,loop:1,ls:4376,le:4627},{file:"z03_r88.wav",root:88,lo:86,hi:88,loop:1,ls:4649,le:4716},{file:"z04_r99.wav",root:99,lo:97,hi:99,loop:1,ls:5202,le:5343},{file:"z05_r107.wav",root:107,lo:104,hi:108,loop:1,ls:5894,le:6005}] },
    // the neoclassical batch (deep pass): GM 0 "Yamaha Grand Piano"
    // zones, made FELT at extraction (3kHz lowpass baked into the zone wavs —
    // fetch-found-samples.sh); soft velocity/slow attack live in the recipe.
    // 10 zones (not 6): the lead sits exposed, so the midrange keymap is dense
    // enough that no note repitches more than ~6 semitones.
    felt_piano: { label:"Felt Piano (FluidR3 Yamaha Grand, MIT; felt = 3kHz lowpass at extraction)", dir:"felt_piano", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r34.wav",root:34,lo:31,hi:34,loop:1,ls:178404,le:227453},{file:"z02_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z03_r50.wav",root:50,lo:47,hi:50,loop:1,ls:106623,le:150964},{file:"z04_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z05_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z06_r78.wav",root:78,lo:75,hi:78,loop:1,ls:65471,le:104349},{file:"z07_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z08_r99.wav",root:99,lo:95,hi:99,loop:1,ls:24558,le:24962},{file:"z09_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    // the liberalization batch ("use the soundfont liberally"): the
    // orchestral shelf (trombone / muted trumpet / oboe / cello / harp /
    // celesta / french horns), keys (honky-tonk, bright grand, church organ,
    // marimba) and voices (ahh choir, harmonica, fretless bass, jazz guitar).
    // These widen samplerPools across the anchors AND supply the transition
    // micro-lick instruments (LICKS below). Recipe: fetch-found-samples.sh.
    trombone: { label:"Trombone (FluidR3, MIT)", dir:"trombone", sr:44100, zones:[{file:"z00_r43.wav",root:42.9,lo:0,hi:43,loop:1,ls:28139,le:28592},{file:"z01_r48.wav",root:47.84,lo:47,hi:48,loop:1,ls:20650,le:21331},{file:"z02_r58.wav",root:58.06,lo:55,hi:58,loop:1,ls:19822,le:20388},{file:"z03_r63.wav",root:62.92,lo:61,hi:63,loop:1,ls:21423,le:22135},{file:"z04_r70.wav",root:70.06,lo:68,hi:70,loop:1,ls:8944,le:9227},{file:"z05_r75.wav",root:75.23,lo:73,hi:96,loop:1,ls:9562,le:9772}] },
    muted_trumpet: { label:"Muted Trumpet (FluidR3, MIT)", dir:"muted_trumpet", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:1,ls:27924,le:29594},{file:"z01_r60.wav",root:60,lo:60,hi:65,loop:1,ls:15449,le:17135},{file:"z02_r66.wav",root:66,lo:66,hi:70,loop:1,ls:19658,le:20850},{file:"z03_r72.wav",root:72,lo:71,hi:74,loop:1,ls:9831,le:10506},{file:"z04_r78.wav",root:78,lo:75,hi:78,loop:1,ls:6908,le:7564},{file:"z05_r84.wav",root:84,lo:79,hi:96,loop:1,ls:13101,le:19557}] },
    oboe: { label:"Oboe (FluidR3, MIT)", dir:"oboe", sr:44100, zones:[{file:"z00_r63.wav",root:63.08,lo:0,hi:63,loop:1,ls:29362,le:38401},{file:"z01_r64.wav",root:64.27,lo:64,hi:65,loop:1,ls:20857,le:29697},{file:"z02_r67.wav",root:67.26,lo:66,hi:68,loop:1,ls:20252,le:28673},{file:"z03_r74.wav",root:74.26,lo:72,hi:75,loop:1,ls:18961,le:26880},{file:"z04_r79.wav",root:79.32,lo:76,hi:79,loop:1,ls:19434,le:28161},{file:"z05_r82.wav",root:81.98,lo:80,hi:96,loop:1,ls:19744,le:28928}] },
    cello: { label:"Cello (FluidR3, MIT)", dir:"cello", sr:44100, zones:[{file:"z00_r37.wav",root:37.1,lo:0,hi:39,loop:1,ls:78629,le:88149},{file:"z01_r46.wav",root:45.91,lo:46,hi:48,loop:1,ls:66854,le:76368},{file:"z02_r58.wav",root:58,lo:58,hi:60,loop:1,ls:52797,le:62449},{file:"z03_r67.wav",root:67,lo:67,hi:69,loop:1,ls:58773,le:66648},{file:"z04_r79.wav",root:79.04,lo:79,hi:81,loop:1,ls:49141,le:57720},{file:"z05_r88.wav",root:88.111,lo:88,hi:117,loop:1,ls:66222,le:74043}] },
    harp: { label:"Harp (FluidR3, MIT)", dir:"harp", sr:44100, zones:[{file:"z00_r34.wav",root:34,lo:0,hi:39,loop:1,ls:52377,le:53889},{file:"z01_r54.wav",root:54,lo:51,hi:55,loop:1,ls:51328,le:52278},{file:"z02_r61.wav",root:61,lo:60,hi:62,loop:1,ls:30340,le:30977},{file:"z03_r70.wav",root:70,lo:69,hi:71,loop:1,ls:25472,le:25851},{file:"z04_r78.wav",root:78,lo:76,hi:81,loop:1,ls:18866,le:19105},{file:"z05_r102.wav",root:102,lo:102,hi:108,loop:1,ls:8909,le:9264}] },
    celesta: { label:"Celesta (FluidR3, MIT)", dir:"celesta", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:1,ls:25359,le:26312},{file:"z01_r60.wav",root:60,lo:60,hi:65,loop:1,ls:19225,le:19562},{file:"z02_r72.wav",root:72,lo:72,hi:77,loop:1,ls:22571,le:23245},{file:"z03_r78.wav",root:78,lo:78,hi:83,loop:1,ls:21396,le:21873},{file:"z04_r90.wav",root:90,lo:90,hi:95,loop:1,ls:9497,le:9884},{file:"z05_r96.wav",root:96,lo:96,hi:108,loop:1,ls:11684,le:11705}] },
    ahh_choir: { label:"Ahh Choir (FluidR3, MIT)", dir:"ahh_choir", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:39,loop:1,ls:53350,le:90898},{file:"z01_r48.wav",root:47.86,lo:46,hi:48,loop:1,ls:62798,le:132963},{file:"z02_r57.wav",root:56.79,lo:55,hi:57,loop:1,ls:40321,le:115053},{file:"z03_r63.wav",root:62.755,lo:61,hi:63,loop:1,ls:46393,le:108508},{file:"z04_r72.wav",root:72,lo:70,hi:72,loop:1,ls:24795,le:73216},{file:"z05_r81.wav",root:81,lo:79,hi:96,loop:1,ls:36668,le:102348}] },
    fretless_bass: { label:"Fretless Bass (FluidR3, MIT)", dir:"fretless_bass", sr:44100, zones:[{file:"z00_r28.wav",root:27.96,lo:0,hi:28,loop:1,ls:137065,le:138139},{file:"z01_r31.wav",root:31.03,lo:29,hi:31,loop:1,ls:127123,le:129828},{file:"z02_r38.wav",root:38.14,lo:35,hi:38,loop:1,ls:80403,le:80999},{file:"z03_r44.wav",root:44.15,lo:39,hi:44,loop:1,ls:57712,le:58976},{file:"z04_r62.wav",root:62.12,lo:49,hi:84,loop:1,ls:62040,le:62789},{file:"z05_r76.wav",root:75.96,lo:0,hi:84,loop:1,ls:29,le:96}] },
    harmonica: { label:"Harmonica (FluidR3, MIT)", dir:"harmonica", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:60,loop:1,ls:16175,le:16849},{file:"z01_r64.wav",root:64,lo:61,hi:65,loop:1,ls:16326,le:17664},{file:"z02_r72.wav",root:72,lo:70,hi:72,loop:1,ls:17099,le:17352},{file:"z03_r76.wav",root:76,lo:73,hi:76,loop:1,ls:15704,le:16507},{file:"z04_r84.wav",root:84,lo:81,hi:84,loop:1,ls:16500,le:16879},{file:"z05_r88.wav",root:88,lo:85,hi:96,loop:1,ls:16280,le:16748}] },
    church_organ: { label:"Church Organ (FluidR3, MIT)", dir:"church_organ", sr:44100, zones:[{file:"z00_r36.wav",root:36.296,lo:0,hi:36,loop:1,ls:49044,le:122496},{file:"z01_r48.wav",root:48,lo:46,hi:48,loop:1,ls:114672,le:219938},{file:"z02_r60.wav",root:60,lo:58,hi:60,loop:1,ls:90944,le:180760},{file:"z03_r72.wav",root:72,lo:70,hi:72,loop:1,ls:27494,le:115968},{file:"z04_r84.wav",root:84,lo:82,hi:84,loop:1,ls:27266,le:109952},{file:"z05_r96.wav",root:96,lo:94,hi:96,loop:1,ls:35788,le:102578}] },
    honky_tonk: { label:"Honky-Tonk Piano (FluidR3, MIT)", dir:"honky_tonk", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z02_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z03_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z05_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    french_horns: { label:"French Horns (FluidR3, MIT)", dir:"french_horns", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:40,loop:1,ls:62667,le:128232},{file:"z01_r45.wav",root:45,lo:41,hi:46,loop:1,ls:53547,le:132097},{file:"z02_r51.wav",root:51,lo:47,hi:52,loop:1,ls:57345,le:186331},{file:"z03_r63.wav",root:63,lo:59,hi:64,loop:1,ls:92753,le:221698},{file:"z04_r69.wav",root:69,lo:65,hi:70,loop:1,ls:50785,le:116044},{file:"z05_r75.wav",root:75,lo:71,hi:96,loop:1,ls:31744,le:136706}] },
    jazz_guitar: { label:"Jazz Guitar (FluidR3, MIT)", dir:"jazz_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.12,lo:0,hi:40,loop:1,ls:75946,le:77010},{file:"z01_r45.wav",root:45.26,lo:44,hi:45,loop:1,ls:63390,le:64970},{file:"z02_r50.wav",root:50.22,lo:49,hi:50,loop:1,ls:110634,le:112710},{file:"z03_r59.wav",root:59.25,lo:56,hi:60,loop:1,ls:81598,le:82126},{file:"z04_r69.wav",root:69.45,lo:65,hi:69,loop:1,ls:34360,le:36804},{file:"z05_r79.wav",root:79.42,lo:75,hi:96,loop:1,ls:39496,le:41638}] },
    bright_yamaha_grand: { label:"Bright Grand Piano (FluidR3, MIT)", dir:"bright_yamaha_grand", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z02_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z03_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z05_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    marimba: { label:"Marimba (FluidR3, MIT)", dir:"marimba", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:53,loop:0,ls:8,le:95224},{file:"z01_r60.wav",root:60,lo:54,hi:65,loop:0,ls:8,le:75896},{file:"z02_r66.wav",root:66,lo:66,hi:71,loop:0,ls:8,le:74090},{file:"z03_r72.wav",root:72,lo:72,hi:77,loop:0,ls:8,le:58616},{file:"z04_r78.wav",root:78,lo:78,hi:83,loop:0,ls:8,le:58020},{file:"z05_r84.wav",root:84,lo:84,hi:108,loop:0,ls:8,le:52728}] },
    // the sampler-review batch ): 11 FluidR3 programs the review found
    // untapped, all past the >1-spread-zone quality gate. Draft-blocking musette/
    // toy shelf (accordion, tuba, pan_flute, kalimba, glockenspiel) + history
    // repoints turning DX7 fakes into the real thing (harpsichord=prelude's Bach,
    // clavinet=newjack FUNK CLAV, pizzicato_strings=tango marcato, finger_bass=
    // citypop's fingered electric, sitar=Goa/tiki, steel_drums=exotica tiki).
    // Tubular Bells REJECTED (five byte-identical C6 zones — the DrawbarOrgan
    // failure); glockenspiel is the bright-bell stand-in. Recipe: fetch-found-
    // samples.sh; zone wavs gitignored under found/samples/instruments/<dir>/.
    accordion: { label:"Accordion (FluidR3, MIT)", dir:"accordian", sr:44100, zones:[{file:"z00_r60.wav",root:60.207,lo:0,hi:60,loop:1,ls:73258,le:364474},{file:"z01_r66.wav",root:66.147,lo:61,hi:66,loop:1,ls:87376,le:282128},{file:"z02_r72.wav",root:72.142,lo:67,hi:72,loop:1,ls:70740,le:199184},{file:"z03_r78.wav",root:78.14,lo:73,hi:78,loop:1,ls:47466,le:143928},{file:"z04_r84.wav",root:84,lo:79,hi:84,loop:1,ls:15786,le:118880},{file:"z05_r90.wav",root:90,lo:85,hi:108,loop:1,ls:6830,le:49586}] },
    tuba: { label:"Tuba (FluidR3, MIT)", dir:"tuba", sr:44100, zones:[{file:"z00_r24.wav",root:23.87,lo:0,hi:24,loop:1,ls:27190,le:35347},{file:"z01_r29.wav",root:28.8,lo:25,hi:29,loop:1,ls:16955,le:19001},{file:"z02_r39.wav",root:38.99,lo:35,hi:39,loop:1,ls:7866,le:9001},{file:"z03_r44.wav",root:43.84,lo:40,hi:44,loop:1,ls:5572,le:6001},{file:"z04_r54.wav",root:54.15,lo:50,hi:54,loop:1,ls:5528,le:6001},{file:"z05_r59.wav",root:59.16,lo:55,hi:72,loop:1,ls:6824,le:7001}] },
    pan_flute: { label:"Pan Flute (FluidR3, MIT)", dir:"pan_flute", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:55,loop:1,ls:34724,le:52131},{file:"z01_r60.wav",root:60,lo:56,hi:61,loop:1,ls:21350,le:39223},{file:"z02_r72.wav",root:72,lo:68,hi:73,loop:1,ls:16545,le:34498},{file:"z03_r78.wav",root:78,lo:74,hi:79,loop:1,ls:16460,le:25882},{file:"z04_r90.wav",root:90,lo:86,hi:91,loop:1,ls:8929,le:17934},{file:"z05_r96.wav",root:96,lo:92,hi:127,loop:1,ls:7717,le:16552}] },
    kalimba: { label:"Kalimba (FluidR3, MIT)", dir:"kalimba", sr:44100, zones:[{file:"z00_r55.wav",root:55,lo:0,hi:56,loop:1,ls:13876,le:15001},{file:"z01_r65.wav",root:65,lo:57,hi:65,loop:1,ls:13993,le:15001},{file:"z02_r69.wav",root:69,lo:66,hi:69,loop:1,ls:14000,le:15001},{file:"z03_r77.wav",root:77,lo:70,hi:78,loop:1,ls:13990,le:15001},{file:"z04_r84.wav",root:84,lo:79,hi:84,loop:1,ls:13989,le:15001},{file:"z05_r96.wav",root:96,lo:85,hi:127,loop:1,ls:13990,le:15001}] },
    glockenspiel: { label:"Glockenspiel (FluidR3, MIT)", dir:"glockenspiel", sr:44100, zones:[{file:"z00_r79.wav",root:79,lo:0,hi:79,loop:1,ls:35102,le:36001},{file:"z01_r84.wav",root:84,lo:80,hi:84,loop:1,ls:35202,le:36001},{file:"z02_r91.wav",root:91,lo:88,hi:91,loop:1,ls:35104,le:36001},{file:"z03_r96.wav",root:96,lo:92,hi:96,loop:1,ls:35037,le:36001},{file:"z04_r103.wav",root:103,lo:100,hi:103,loop:1,ls:35050,le:36001},{file:"z05_r108.wav",root:108,lo:104,hi:127,loop:1,ls:35028,le:36001}] },
    harpsichord: { label:"Harpsichord (FluidR3, MIT)", dir:"harpsichord", sr:44100, zones:[{file:"z00_r38.wav",root:38,lo:0,hi:39,loop:1,ls:167374,le:170995},{file:"z01_r48.wav",root:48,lo:45,hi:48,loop:1,ls:99441,le:102477},{file:"z02_r60.wav",root:60,lo:55,hi:61,loop:1,ls:91398,le:93249},{file:"z03_r71.wav",root:71,lo:66,hi:71,loop:1,ls:37383,le:39081},{file:"z04_r86.wav",root:86,lo:78,hi:86,loop:1,ls:30172,le:30397},{file:"z05_r96.wav",root:96,lo:96,hi:127,loop:1,ls:35993,le:36753}] },
    pizzicato_strings: { label:"Pizzicato Strings (FluidR3, MIT)", dir:"pizzicato_section", sr:44100, zones:[{file:"z00_r36.wav",root:36,lo:0,hi:37,loop:0,ls:11,le:106887},{file:"z01_r48.wav",root:48.526,lo:46,hi:48,loop:0,ls:11,le:73019},{file:"z02_r56.wav",root:56,lo:53,hi:56,loop:0,ls:11,le:63846},{file:"z03_r66.wav",root:66,lo:64,hi:66,loop:0,ls:11,le:60582},{file:"z04_r74.wav",root:74,lo:71,hi:74,loop:0,ls:11,le:55202},{file:"z05_r88.wav",root:88,lo:84,hi:96,loop:0,ls:11,le:42325}] },
    clavinet: { label:"Clavinet (FluidR3, MIT)", dir:"clavinet", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:8438,le:9340},{file:"z01_r43.wav",root:43,lo:37,hi:43,loop:1,ls:7456,le:7906},{file:"z02_r55.wav",root:55,lo:49,hi:55,loop:1,ls:8370,le:8594},{file:"z03_r67.wav",root:67,lo:61,hi:67,loop:1,ls:7453,le:7678},{file:"z04_r79.wav",root:79,lo:73,hi:79,loop:1,ls:9054,le:9279},{file:"z05_r91.wav",root:91,lo:85,hi:108,loop:1,ls:8391,le:8644}] },
    finger_bass: { label:"Fingered Bass (FluidR3, MIT)", dir:"fingered_bass", sr:44100, zones:[{file:"z00_r28.wav",root:28,lo:0,hi:28,loop:1,ls:168092,le:169162},{file:"z01_r32.wav",root:32.04,lo:31,hi:32,loop:1,ls:139242,le:140090},{file:"z02_r34.wav",root:34,lo:33,hi:34,loop:1,ls:122864,le:123622},{file:"z03_r39.wav",root:38.98,lo:38,hi:39,loop:1,ls:135968,le:137104},{file:"z04_r41.wav",root:40.99,lo:40,hi:42,loop:1,ls:129874,le:130380},{file:"z05_r48.wav",root:48,lo:48,hi:84,loop:1,ls:127910,le:128922}] },
    sitar: { label:"Sitar (FluidR3, MIT)", dir:"sitar", sr:44100, zones:[{file:"z00_r52.wav",root:51.99,lo:0,hi:54,loop:1,ls:28998,le:31674},{file:"z01_r55.wav",root:54.99,lo:55,hi:59,loop:1,ls:24270,le:31246},{file:"z02_r64.wav",root:63.99,lo:64,hi:67,loop:1,ls:20642,le:24387},{file:"z03_r72.wav",root:71.99,lo:68,hi:72,loop:1,ls:13386,le:16673},{file:"z04_r84.wav",root:83.99,lo:81,hi:88,loop:1,ls:6714,le:8315},{file:"z05_r91.wav",root:90.99,lo:89,hi:108,loop:1,ls:5945,le:7070}] },
    steel_drums: { label:"Steel Drums (FluidR3, MIT)", dir:"steel_drums", sr:44100, zones:[{file:"z00_r66.wav",root:66,lo:0,hi:66,loop:0,ls:15,le:26831},{file:"z01_r72.wav",root:72,lo:67,hi:72,loop:0,ls:10,le:19015},{file:"z02_r78.wav",root:78,lo:73,hi:78,loop:0,ls:8,le:13495},{file:"z03_r84.wav",root:84,lo:79,hi:127,loop:0,ls:10,le:9585}] },

    // ---- FULL GM registry (all of GM): 65 more bank-0 FluidR3 presets,
    // generated from their zones.json by faust/extract-gm.js. Same {label,dir,sr,zones}
    // shape as the hand-curated entries above; keyed by directory slug. ----
    atmosphere: { label:"Atmosphere (FluidR3, MIT)", dir:"atmosphere", sr:44100, zones:[{file:"z00_r40.wav",root:40,lo:0,hi:43,loop:1,ls:192810,le:193345},{file:"z01_r50.wav",root:50,lo:49,hi:53,loop:1,ls:198834,le:200036},{file:"z02_r59.wav",root:59,lo:59,hi:62,loop:1,ls:62185,le:62542},{file:"z03_r69.wav",root:69.05,lo:68,hi:70,loop:1,ls:36509,le:37008},{file:"z04_r76.wav",root:76.1,lo:76,hi:83,loop:1,ls:30993,le:31458},{file:"z05_r84.wav",root:84,lo:84,hi:108,loop:1,ls:19524,le:19817}] },
    bagpipe: { label:"BagPipe (FluidR3, MIT)", dir:"bagpipe", sr:44100, zones:[{file:"z00_r57.wav",root:57.07,lo:0,hi:57,loop:1,ls:65190,le:110476},{file:"z01_r65.wav",root:65.02,lo:58,hi:65,loop:1,ls:71502,le:169554},{file:"z02_r72.wav",root:72.02,lo:66,hi:72,loop:1,ls:44258,le:184480},{file:"z03_r75.wav",root:75.02,lo:73,hi:75,loop:1,ls:71178,le:141822},{file:"z04_r79.wav",root:79.02,lo:76,hi:79,loop:1,ls:48650,le:145658},{file:"z05_r86.wav",root:86.02,lo:80,hi:127,loop:1,ls:27054,le:96922}] },
    banjo: { label:"Banjo (FluidR3, MIT)", dir:"banjo", sr:44100, zones:[{file:"z00_r50.wav",root:50.13,lo:0,hi:52,loop:1,ls:71942,le:74025},{file:"z01_r55.wav",root:54.975,lo:53,hi:58,loop:1,ls:88184,le:88854},{file:"z02_r59.wav",root:59.08,lo:59,hi:62,loop:1,ls:78873,le:80297},{file:"z03_r62.wav",root:62.21,lo:70,hi:73,loop:1,ls:71867,le:73055},{file:"z04_r66.wav",root:66.32,lo:63,hi:69,loop:1,ls:56507,le:56858},{file:"z05_r74.wav",root:74.21,lo:74,hi:127,loop:0,ls:35932,le:36527}] },
    baritone_sax: { label:"Baritone Sax (FluidR3, MIT)", dir:"baritone_sax", sr:44100, zones:[{file:"z00_r37.wav",root:36.97,lo:0,hi:37,loop:1,ls:94957,le:106444},{file:"z01_r43.wav",root:43,lo:42,hi:43,loop:1,ls:125244,le:136520},{file:"z02_r48.wav",root:48.04,lo:48,hi:49,loop:1,ls:117718,le:127832},{file:"z03_r55.wav",root:55.03,lo:55,hi:56,loop:1,ls:138999,le:149560},{file:"z04_r62.wav",root:62.05,lo:61,hi:62,loop:1,ls:99709,le:109291},{file:"z05_r68.wav",root:68.03,lo:67,hi:72,loop:1,ls:98697,le:109893}] },
    bass_lead: { label:"Bass & Lead (FluidR3, MIT)", dir:"bass_lead", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:56,loop:1,ls:201,le:602},{file:"z01_r57.wav",root:57,lo:57,hi:68,loop:1,ls:101,le:301},{file:"z02_r69.wav",root:69,lo:69,hi:80,loop:1,ls:51,le:151},{file:"z03_r81.wav",root:81,lo:81,hi:92,loop:1,ls:26,le:76},{file:"z04_r93.wav",root:93,lo:93,hi:127,loop:1,ls:13,le:63}] },
    bassoon: { label:"Bassoon (FluidR3, MIT)", dir:"bassoon", sr:44100, zones:[{file:"z00_r35.wav",root:35.23,lo:0,hi:35,loop:1,ls:47492,le:59510},{file:"z01_r43.wav",root:43.15,lo:41,hi:43,loop:1,ls:34414,le:46458},{file:"z02_r49.wav",root:49.25,lo:47,hi:49,loop:1,ls:21910,le:32272},{file:"z03_r58.wav",root:58.17,lo:56,hi:58,loop:1,ls:35528,le:47316},{file:"z04_r64.wav",root:63.93,lo:62,hi:64,loop:1,ls:40440,le:52256},{file:"z05_r73.wav",root:73.27,lo:71,hi:84,loop:1,ls:31604,le:42272}] },
    bowed_glass: { label:"Bowed Glass (FluidR3, MIT)", dir:"bowed_glass", sr:44100, zones:[{file:"z00_r76.wav",root:76,lo:0,hi:101,loop:1,ls:120000,le:155510},{file:"z01_r84.wav",root:84,lo:0,hi:108,loop:1,ls:24749,le:25001},{file:"z02_r84.wav",root:84,lo:0,hi:127,loop:1,ls:7588,le:10878}] },
    brass_section: { label:"Brass Section (FluidR3, MIT)", dir:"brass_section", sr:44100, zones:[{file:"z00_r41.wav",root:41,lo:0,hi:41,loop:1,ls:155749,le:232502},{file:"z01_r54.wav",root:54,lo:49,hi:54,loop:1,ls:86538,le:221724},{file:"z02_r60.wav",root:60,lo:59,hi:60,loop:1,ls:58393,le:163328},{file:"z03_r65.wav",root:65,lo:61,hi:65,loop:1,ls:65107,le:180190},{file:"z04_r72.wav",root:72,lo:70,hi:72,loop:1,ls:20484,le:99824},{file:"z05_r84.wav",root:84,lo:78,hi:96,loop:1,ls:53255,le:162287}] },
    charang: { label:"Charang (FluidR3, MIT)", dir:"charang", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:8438,le:9340},{file:"z01_r45.wav",root:45,lo:0,hi:56,loop:1,ls:201,le:602},{file:"z02_r57.wav",root:57,lo:57,hi:68,loop:1,ls:101,le:301},{file:"z03_r69.wav",root:69,lo:69,hi:80,loop:1,ls:51,le:151},{file:"z04_r81.wav",root:81,lo:81,hi:92,loop:1,ls:26,le:76},{file:"z05_r93.wav",root:93,lo:93,hi:127,loop:1,ls:13,le:63}] },
    chiffer_lead: { label:"Chiffer Lead (FluidR3, MIT)", dir:"chiffer_lead", sr:44100, zones:[{file:"z00_r72.wav",root:72,lo:0,hi:127,loop:0,ls:54746,le:129120},{file:"z01_r84.wav",root:84,lo:0,hi:127,loop:1,ls:2492,le:2825},{file:"z02_r93.wav",root:93,lo:0,hi:127,loop:1,ls:9830,le:9905}] },
    clean_guitar: { label:"Clean Guitar (FluidR3, MIT)", dir:"clean_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.24,lo:0,hi:44,loop:1,ls:70662,le:71718},{file:"z01_r50.wav",root:50.1,lo:50,hi:54,loop:1,ls:76510,le:78600},{file:"z02_r59.wav",root:59.15,lo:59,hi:63,loop:1,ls:71180,le:72774},{file:"z03_r64.wav",root:64.14,lo:64,hi:65,loop:1,ls:42746,le:43410},{file:"z04_r71.wav",root:71.12,lo:70,hi:71,loop:1,ls:45928,le:46460},{file:"z05_r79.wav",root:79.08,lo:77,hi:127,loop:1,ls:56974,le:57478}] },
    contrabass: { label:"Contrabass (FluidR3, MIT)", dir:"contrabass", sr:44100, zones:[{file:"z00_r29.wav",root:28.89,lo:0,hi:29,loop:1,ls:42549,le:52721},{file:"z01_r32.wav",root:31.94,lo:30,hi:32,loop:1,ls:34085,le:44327},{file:"z02_r38.wav",root:37.78,lo:36,hi:38,loop:1,ls:39414,le:49148},{file:"z03_r41.wav",root:40.86,lo:39,hi:41,loop:1,ls:31369,le:42575},{file:"z04_r47.wav",root:46.87,lo:45,hi:48,loop:1,ls:33761,le:43838},{file:"z05_r50.wav",root:49.94,lo:49,hi:57,loop:1,ls:29290,le:38035}] },
    crystal: { label:"Crystal (FluidR3, MIT)", dir:"crystal", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:56,loop:1,ls:199,le:599},{file:"z01_r57.wav",root:57,lo:57,hi:68,loop:1,ls:97,le:297},{file:"z02_r69.wav",root:69,lo:69,hi:80,loop:1,ls:47,le:147},{file:"z03_r81.wav",root:81,lo:81,hi:92,loop:1,ls:21,le:71},{file:"z04_r93.wav",root:93,lo:93,hi:108,loop:1,ls:10,le:60}] },
    distortion_guitar: { label:"Distortion Guitar (FluidR3, MIT)", dir:"distortion_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40,lo:0,hi:43,loop:1,ls:491852,le:495062},{file:"z01_r50.wav",root:49.856,lo:49,hi:53,loop:1,ls:172604,le:174707},{file:"z02_r59.wav",root:59.224,lo:58,hi:60,loop:1,ls:121963,le:122855},{file:"z03_r64.wav",root:64.01,lo:61,hi:65,loop:1,ls:78333,le:79002},{file:"z04_r71.wav",root:70.96,lo:70,hi:72,loop:1,ls:76505,le:77490},{file:"z05_r79.wav",root:78.9,lo:77,hi:108,loop:1,ls:99545,le:100791}] },
    dulcimer: { label:"Dulcimer (FluidR3, MIT)", dir:"dulcimer", sr:44100, zones:[{file:"z00_r60.wav",root:60,lo:0,hi:61,loop:1,ls:50967,le:65905},{file:"z01_r67.wav",root:67,lo:62,hi:70,loop:1,ls:79507,le:95482},{file:"z02_r72.wav",root:72,lo:71,hi:73,loop:1,ls:64254,le:79467},{file:"z03_r79.wav",root:79,lo:74,hi:81,loop:1,ls:79490,le:95599},{file:"z04_r84.wav",root:84,lo:82,hi:88,loop:1,ls:27739,le:39944},{file:"z05_r96.wav",root:96,lo:89,hi:108,loop:1,ls:44309,le:55368}] },
    echo_drops: { label:"Echo Drops (FluidR3, MIT)", dir:"echo_drops", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:39,loop:1,ls:53350,le:90898},{file:"z01_r48.wav",root:47.86,lo:46,hi:48,loop:1,ls:62798,le:132963},{file:"z02_r60.wav",root:59.777,lo:58,hi:60,loop:1,ls:57404,le:112797},{file:"z03_r66.wav",root:66.191,lo:66,hi:71,loop:1,ls:42289,le:80458},{file:"z04_r78.wav",root:78,lo:76,hi:78,loop:1,ls:20675,le:76086},{file:"z05_r90.wav",root:90,lo:90,hi:96,loop:1,ls:17304,le:32713}] },
    electric_piano: { label:"Electric Piano (FluidR3, MIT)", dir:"electric_piano", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:155339,le:158042},{file:"z01_r43.wav",root:43,lo:37,hi:43,loop:1,ls:171305,le:172203},{file:"z02_r55.wav",root:55,lo:49,hi:55,loop:1,ls:128291,le:129192},{file:"z03_r72.wav",root:72,lo:68,hi:72,loop:1,ls:126017,le:127197},{file:"z04_r84.wav",root:84,lo:80,hi:84,loop:1,ls:97181,le:98021},{file:"z05_r96.wav",root:96.123,lo:92,hi:108,loop:1,ls:71050,le:72054}] },
    english_horn: { label:"English Horn (FluidR3, MIT)", dir:"english_horn", sr:44100, zones:[{file:"z00_r52.wav",root:52.15,lo:0,hi:52,loop:1,ls:69323,le:78359},{file:"z01_r55.wav",root:55.16,lo:53,hi:55,loop:1,ls:45528,le:54679},{file:"z02_r60.wav",root:60.24,lo:59,hi:61,loop:1,ls:77909,le:85562},{file:"z03_r66.wav",root:66.22,lo:62,hi:64,loop:1,ls:55217,le:66655},{file:"z04_r71.wav",root:71.4,lo:69,hi:72,loop:1,ls:59340,le:67458},{file:"z05_r74.wav",root:74.35,lo:73,hi:85,loop:1,ls:57763,le:66147}] },
    fantasia: { label:"Fantasia (FluidR3, MIT)", dir:"fantasia", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:45,loop:1,ls:189,le:590},{file:"z01_r57.wav",root:57,lo:46,hi:57,loop:1,ls:93,le:294},{file:"z02_r69.wav",root:69,lo:58,hi:69,loop:1,ls:8,le:109},{file:"z03_r76.wav",root:76,lo:0,hi:96,loop:1,ls:120000,le:155510},{file:"z04_r81.wav",root:81,lo:70,hi:96,loop:1,ls:125,le:175},{file:"z05_r84.wav",root:84.169,lo:97,hi:108,loop:1,ls:19277,le:45867}] },
    fiddle: { label:"Fiddle (FluidR3, MIT)", dir:"fiddle", sr:44100, zones:[{file:"z00_r56.wav",root:55.85,lo:0,hi:58,loop:1,ls:55974,le:64117},{file:"z01_r65.wav",root:65,lo:65,hi:67,loop:1,ls:50770,le:59099},{file:"z02_r74.wav",root:74.157,lo:72,hi:74,loop:1,ls:67663,le:75312},{file:"z03_r83.wav",root:82.837,lo:81,hi:83,loop:1,ls:58675,le:66559},{file:"z04_r89.wav",root:88.954,lo:87,hi:89,loop:1,ls:50513,le:58174},{file:"z05_r98.wav",root:97.8,lo:97,hi:101,loop:1,ls:25376,le:33537}] },
    fifth_sawtooth_wave: { label:"Fifth Sawtooth Wave (FluidR3, MIT)", dir:"fifth_sawtooth_wave", sr:44100, zones:[{file:"z00_r45.wav",root:45.02,lo:0,hi:45,loop:1,ls:8,le:409},{file:"z01_r57.wav",root:57.02,lo:46,hi:57,loop:1,ls:8,le:208},{file:"z02_r69.wav",root:69.02,lo:58,hi:69,loop:1,ls:9,le:109},{file:"z03_r81.wav",root:81.02,lo:70,hi:127,loop:1,ls:8,le:58}] },
    goblin: { label:"Goblin (FluidR3, MIT)", dir:"goblin", sr:44100, zones:[{file:"z00_r72.wav",root:72,lo:0,hi:127,loop:1,ls:28517,le:67578},{file:"z01_r76.wav",root:76,lo:0,hi:127,loop:1,ls:7588,le:10878},{file:"z02_r84.wav",root:84,lo:0,hi:127,loop:1,ls:21530,le:42811}] },
    guitar_harmonics: { label:"Guitar Harmonics (FluidR3, MIT)", dir:"guitar_harmonics", sr:44100, zones:[{file:"z00_r28.wav",root:28,lo:0,hi:28,loop:1,ls:63070,le:63870},{file:"z01_r38.wav",root:38.2,lo:34,hi:38,loop:1,ls:38564,le:39158},{file:"z02_r43.wav",root:43.09,lo:41,hi:43,loop:1,ls:35139,le:35251},{file:"z03_r47.wav",root:47.3,lo:46,hi:47,loop:1,ls:40550,le:41164},{file:"z04_r55.wav",root:55.15,lo:51,hi:55,loop:1,ls:19352,le:19798},{file:"z05_r64.wav",root:64.5,lo:60,hi:85,loop:1,ls:9774,le:10230}] },
    ice_rain: { label:"Ice Rain (FluidR3, MIT)", dir:"ice_rain", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:45,loop:1,ls:189,le:590},{file:"z01_r57.wav",root:57,lo:46,hi:57,loop:1,ls:93,le:294},{file:"z02_r69.wav",root:69,lo:58,hi:69,loop:1,ls:8,le:109},{file:"z03_r82.wav",root:108.47,lo:0,hi:108,loop:1,ls:3,le:1361},{file:"z04_r84.wav",root:84.169,lo:0,hi:108,loop:1,ls:19277,le:45867},{file:"z05_r84.wav",root:84.169,lo:97,hi:108,loop:1,ls:19277,le:45867}] },
    koto: { label:"Koto (FluidR3, MIT)", dir:"koto", sr:44100, zones:[{file:"z00_r60.wav",root:60,lo:0,hi:60,loop:1,ls:15819,le:16157},{file:"z01_r66.wav",root:66,lo:61,hi:66,loop:1,ls:14277,le:14754},{file:"z02_r78.wav",root:78,lo:67,hi:127,loop:1,ls:7608,le:7847}] },
    legend_ep_2: { label:"Legend EP 2 (FluidR3, MIT)", dir:"legend_ep_2", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:53,loop:0,ls:431599,le:511031},{file:"z01_r60.wav",root:60,lo:60,hi:65,loop:1,ls:286535,le:328477},{file:"z02_r66.wav",root:66,lo:66,hi:71,loop:1,ls:250290,le:278386},{file:"z03_r78.wav",root:78,lo:78,hi:83,loop:1,ls:123081,le:136652},{file:"z04_r84.wav",root:84,lo:84,hi:89,loop:1,ls:107595,le:116562},{file:"z05_r96.wav",root:96,lo:96,hi:108,loop:1,ls:54293,le:69553}] },
    music_box: { label:"Music Box (FluidR3, MIT)", dir:"music_box", sr:44100, zones:[{file:"z00_r44.wav",root:44,lo:0,hi:44,loop:1,ls:36227,le:39197},{file:"z01_r55.wav",root:55,lo:51,hi:55,loop:1,ls:32500,le:34074},{file:"z02_r64.wav",root:64,lo:61,hi:64,loop:1,ls:36257,le:36658},{file:"z03_r73.wav",root:73,lo:71,hi:73,loop:1,ls:27326,le:27962},{file:"z04_r79.wav",root:79,lo:78,hi:82,loop:1,ls:24108,le:24445},{file:"z05_r90.wav",root:90,lo:89,hi:108,loop:1,ls:24360,le:24628}] },
    ocarina: { label:"Ocarina (FluidR3, MIT)", dir:"ocarina", sr:44100, zones:[{file:"z00_r52.wav",root:52,lo:0,hi:52,loop:1,ls:39130,le:60001},{file:"z01_r62.wav",root:62,lo:53,hi:67,loop:1,ls:39149,le:60001},{file:"z02_r76.wav",root:76,lo:68,hi:92,loop:1,ls:40234,le:60001},{file:"z03_r93.wav",root:93,lo:93,hi:108,loop:1,ls:20002,le:40001}] },
    ohh_voices: { label:"Ohh Voices (FluidR3, MIT)", dir:"ohh_voices", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:53,loop:1,ls:59937,le:91980},{file:"z01_r54.wav",root:54,lo:54,hi:59,loop:1,ls:40991,le:65318},{file:"z02_r60.wav",root:60,lo:60,hi:65,loop:1,ls:59079,le:95838},{file:"z03_r72.wav",root:72,lo:72,hi:77,loop:1,ls:29436,le:47900},{file:"z04_r78.wav",root:78,lo:78,hi:83,loop:1,ls:39796,le:52851},{file:"z05_r84.wav",root:84,lo:84,hi:96,loop:1,ls:35012,le:56846}] },
    orchestra_hit: { label:"Orchestra Hit (FluidR3, MIT)", dir:"orchestra_hit", sr:44100, zones:[{file:"z00_r68.wav",root:68,lo:0,hi:68,loop:0,ls:8,le:37084},{file:"z01_r80.wav",root:80,lo:69,hi:96,loop:0,ls:8,le:22264}] },
    overdrive_guitar: { label:"Overdrive Guitar (FluidR3, MIT)", dir:"overdrive_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.05,lo:0,hi:43,loop:1,ls:491908,le:494046},{file:"z01_r50.wav",root:49.761,lo:49,hi:53,loop:1,ls:477040,le:478244},{file:"z02_r59.wav",root:58.95,lo:58,hi:60,loop:1,ls:293414,le:294310},{file:"z03_r64.wav",root:63.9,lo:61,hi:65,loop:1,ls:151604,le:152546},{file:"z04_r71.wav",root:70.84,lo:70,hi:72,loop:1,ls:134526,le:134976},{file:"z05_r79.wav",root:78.81,lo:77,hi:108,loop:1,ls:104422,le:112158}] },
    palm_muted_guitar: { label:"Palm Muted Guitar (FluidR3, MIT)", dir:"palm_muted_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.15,lo:0,hi:40,loop:1,ls:35629,le:36159},{file:"z01_r45.wav",root:45.28,lo:44,hi:45,loop:1,ls:27878,le:28669},{file:"z02_r50.wav",root:50.23,lo:49,hi:50,loop:1,ls:31906,le:32203},{file:"z03_r54.wav",root:54.23,lo:51,hi:54,loop:0,ls:8,le:28395},{file:"z04_r62.wav",root:62.32,lo:59,hi:62,loop:0,ls:8,le:23842},{file:"z05_r70.wav",root:70.44,lo:66,hi:84,loop:0,ls:8,le:21264}] },
    piccolo: { label:"Piccolo (FluidR3, MIT)", dir:"piccolo", sr:44100, zones:[{file:"z00_r64.wav",root:76,lo:0,hi:76,loop:1,ls:22894,le:33281},{file:"z01_r66.wav",root:78,lo:77,hi:78,loop:1,ls:24651,le:35584},{file:"z02_r70.wav",root:81.95,lo:81,hi:82,loop:1,ls:22530,le:33536},{file:"z03_r72.wav",root:84.32,lo:83,hi:84,loop:1,ls:24235,le:35328},{file:"z04_r80.wav",root:92.21,lo:89,hi:92,loop:1,ls:29297,le:39937},{file:"z05_r84.wav",root:96.2,lo:93,hi:120,loop:1,ls:28519,le:39168}] },
    picked_bass: { label:"Picked Bass (FluidR3, MIT)", dir:"picked_bass", sr:44100, zones:[{file:"z00_r28.wav",root:28.08,lo:0,hi:28,loop:1,ls:252346,le:253410},{file:"z01_r32.wav",root:32.09,lo:31,hi:32,loop:1,ls:150250,le:151098},{file:"z02_r34.wav",root:34,lo:33,hi:34,loop:1,ls:191842,le:192600},{file:"z03_r39.wav",root:38.99,lo:38,hi:39,loop:1,ls:185086,le:186222},{file:"z04_r41.wav",root:40.99,lo:40,hi:42,loop:1,ls:174570,le:175584},{file:"z05_r48.wav",root:48.03,lo:48,hi:84,loop:1,ls:147952,le:148964}] },
    pop_bass: { label:"Pop Bass (FluidR3, MIT)", dir:"pop_bass", sr:44100, zones:[{file:"z00_r28.wav",root:28.01,lo:0,hi:28,loop:1,ls:243552,le:245692},{file:"z01_r32.wav",root:32.03,lo:31,hi:32,loop:1,ls:254714,le:257268},{file:"z02_r34.wav",root:34.03,lo:33,hi:35,loop:1,ls:237790,le:238548},{file:"z03_r39.wav",root:38.96,lo:38,hi:39,loop:1,ls:287544,le:289820},{file:"z04_r41.wav",root:40.97,lo:40,hi:42,loop:1,ls:240590,le:241602},{file:"z05_r48.wav",root:48.02,lo:46,hi:84,loop:1,ls:192764,le:193776}] },
    recorder: { label:"Recorder (FluidR3, MIT)", dir:"recorder", sr:44100, zones:[{file:"z00_r72.wav",root:72.1,lo:0,hi:72,loop:1,ls:14176,le:24886},{file:"z01_r74.wav",root:73.8,lo:73,hi:74,loop:1,ls:35109,le:46145},{file:"z02_r77.wav",root:77.55,lo:77,hi:77,loop:1,ls:14442,le:26154},{file:"z03_r79.wav",root:79.1,lo:78,hi:79,loop:1,ls:18274,le:28749},{file:"z04_r83.wav",root:82.9,lo:82,hi:83,loop:1,ls:23089,le:36226},{file:"z05_r86.wav",root:85.9,lo:84,hi:97,loop:1,ls:16907,le:28156}] },
    reed_organ: { label:"Reed Organ (FluidR3, MIT)", dir:"reed_organ", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:54,loop:1,ls:5245,le:5721},{file:"z01_r60.wav",root:60,lo:55,hi:60,loop:1,ls:3620,le:3789},{file:"z02_r72.wav",root:72,lo:67,hi:72,loop:1,ls:3121,le:3459},{file:"z03_r78.wav",root:78,lo:73,hi:78,loop:1,ls:3103,le:3282},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:1457,le:1576},{file:"z05_r96.wav",root:96,lo:91,hi:108,loop:1,ls:2414,le:2667}] },
    rhodes_ep: { label:"Rhodes EP (FluidR3, MIT)", dir:"rhodes_ep", sr:44100, zones:[{file:"z00_r24.wav",root:24,lo:0,hi:27,loop:1,ls:286300,le:289006},{file:"z01_r36.wav",root:36,lo:34,hi:39,loop:1,ls:204368,le:205714},{file:"z02_r55.wav",root:55,lo:52,hi:57,loop:1,ls:89348,le:89798},{file:"z03_r67.wav",root:67,lo:64,hi:69,loop:1,ls:78870,le:79320},{file:"z04_r84.wav",root:84,lo:82,hi:87,loop:1,ls:91952,le:93298},{file:"z05_r96.wav",root:96,lo:94,hi:108,loop:1,ls:39068,le:39552}] },
    saw_wave: { label:"Saw Wave (FluidR3, MIT)", dir:"saw_wave", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:56,loop:1,ls:201,le:602},{file:"z01_r57.wav",root:57,lo:57,hi:68,loop:1,ls:101,le:301},{file:"z02_r69.wav",root:69,lo:69,hi:80,loop:1,ls:51,le:151},{file:"z03_r81.wav",root:81,lo:81,hi:92,loop:1,ls:26,le:76},{file:"z04_r93.wav",root:93,lo:93,hi:127,loop:1,ls:13,le:63}] },
    sea_shore: { label:"Sea Shore (FluidR3, MIT)", dir:"sea_shore", sr:44100, zones:[{file:"z00_r60.wav",root:73,lo:0,hi:127,loop:1,ls:65,le:71224},{file:"z01_r68.wav",root:80,lo:0,hi:127,loop:1,ls:65,le:71224}] },
    shamisen: { label:"Shamisen (FluidR3, MIT)", dir:"shamisen", sr:44100, zones:[{file:"z00_r48.wav",root:48.01,lo:0,hi:53,loop:1,ls:8216,le:8890},{file:"z01_r54.wav",root:53.99,lo:54,hi:59,loop:1,ls:12866,le:13821},{file:"z02_r66.wav",root:66,lo:66,hi:71,loop:1,ls:7479,le:8076},{file:"z03_r72.wav",root:72,lo:72,hi:77,loop:1,ls:6947,le:7369},{file:"z04_r84.wav",root:84,lo:84,hi:89,loop:1,ls:3509,le:3804},{file:"z05_r90.wav",root:90,lo:90,hi:127,loop:1,ls:2638,le:2817}] },
    shenai: { label:"Shenai (FluidR3, MIT)", dir:"shenai", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:1,ls:4164,le:4402},{file:"z01_r60.wav",root:60,lo:60,hi:64,loop:1,ls:3780,le:3949},{file:"z02_r66.wav",root:66,lo:65,hi:71,loop:1,ls:3754,le:4112},{file:"z03_r72.wav",root:72,lo:72,hi:76,loop:1,ls:2921,le:3342},{file:"z04_r78.wav",root:78,lo:77,hi:81,loop:1,ls:1922,le:2280},{file:"z05_r84.wav",root:84,lo:82,hi:127,loop:1,ls:1672,le:2600}] },
    slap_bass: { label:"Slap Bass (FluidR3, MIT)", dir:"slap_bass", sr:44100, zones:[{file:"z00_r28.wav",root:27.98,lo:0,hi:28,loop:1,ls:222726,le:225946},{file:"z01_r32.wav",root:32.04,lo:31,hi:32,loop:1,ls:258226,le:261624},{file:"z02_r35.wav",root:35,lo:33,hi:35,loop:1,ls:235956,le:238100},{file:"z03_r39.wav",root:38.98,lo:38,hi:39,loop:1,ls:230432,le:232138},{file:"z04_r41.wav",root:40.96,lo:40,hi:42,loop:1,ls:246106,le:247120},{file:"z05_r48.wav",root:48.02,lo:46,hi:84,loop:1,ls:212140,le:213826}] },
    slow_strings: { label:"Slow Strings (FluidR3, MIT)", dir:"slow_strings", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:56826,le:150523},{file:"z01_r40.wav",root:39.831,lo:38,hi:40,loop:1,ls:54138,le:140576},{file:"z02_r49.wav",root:49,lo:48,hi:51,loop:1,ls:75259,le:139523},{file:"z03_r64.wav",root:64.129,lo:63,hi:65,loop:1,ls:61102,le:159259},{file:"z04_r73.wav",root:73,lo:72,hi:74,loop:1,ls:14601,le:57396},{file:"z05_r83.wav",root:83,lo:82,hi:96,loop:1,ls:27892,le:59980}] },
    solo_vox: { label:"Solo Vox (FluidR3, MIT)", dir:"solo_vox", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:48,loop:1,ls:25811,le:164126},{file:"z01_r60.wav",root:60,lo:49,hi:60,loop:1,ls:17580,le:86907},{file:"z02_r72.wav",root:72,lo:61,hi:72,loop:1,ls:23011,le:57592},{file:"z03_r84.wav",root:84.225,lo:0,hi:127,loop:1,ls:8008,le:26234},{file:"z04_r84.wav",root:84,lo:73,hi:84,loop:1,ls:16422,le:28846},{file:"z05_r96.wav",root:96,lo:85,hi:127,loop:1,ls:23669,le:45981}] },
    soprano_sax: { label:"Soprano Sax (FluidR3, MIT)", dir:"soprano_sax", sr:44100, zones:[{file:"z00_r57.wav",root:56.97,lo:0,hi:57,loop:1,ls:41589,le:51634},{file:"z01_r63.wav",root:63.02,lo:62,hi:63,loop:1,ls:36092,le:45981},{file:"z02_r66.wav",root:65.97,lo:66,hi:67,loop:1,ls:58237,le:68399},{file:"z03_r72.wav",root:71.98,lo:72,hi:73,loop:1,ls:49533,le:59692},{file:"z04_r78.wav",root:78,lo:77,hi:78,loop:1,ls:53500,le:63366},{file:"z05_r85.wav",root:85,lo:84,hi:96,loop:1,ls:46874,le:57059}] },
    space_voice: { label:"Space Voice (FluidR3, MIT)", dir:"space_voice", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:48,loop:1,ls:25811,le:164126},{file:"z01_r60.wav",root:60,lo:49,hi:60,loop:1,ls:17580,le:86907},{file:"z02_r72.wav",root:72,lo:61,hi:72,loop:1,ls:23011,le:57592},{file:"z03_r76.wav",root:76,lo:0,hi:98,loop:1,ls:120000,le:155510},{file:"z04_r84.wav",root:84,lo:73,hi:84,loop:1,ls:16422,le:28846},{file:"z05_r96.wav",root:96,lo:85,hi:127,loop:1,ls:23669,le:45981}] },
    square_lead: { label:"Square Lead (FluidR3, MIT)", dir:"square_lead", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:56,loop:1,ls:199,le:599},{file:"z01_r57.wav",root:57,lo:57,hi:68,loop:1,ls:97,le:297},{file:"z02_r69.wav",root:69,lo:69,hi:80,loop:1,ls:47,le:147},{file:"z03_r81.wav",root:81,lo:81,hi:92,loop:1,ls:21,le:71},{file:"z04_r93.wav",root:93,lo:93,hi:127,loop:1,ls:10,le:60}] },
    star_theme: { label:"Star Theme (FluidR3, MIT)", dir:"star_theme", sr:44100, zones:[{file:"z00_r40.wav",root:40.24,lo:0,hi:44,loop:1,ls:70662,le:71718},{file:"z01_r50.wav",root:50.1,lo:50,hi:54,loop:1,ls:76510,le:78600},{file:"z02_r59.wav",root:59.15,lo:59,hi:63,loop:1,ls:71180,le:72774},{file:"z03_r69.wav",root:69.14,lo:66,hi:69,loop:1,ls:42370,le:43464},{file:"z04_r76.wav",root:76.09,lo:72,hi:76,loop:1,ls:55784,le:56916},{file:"z05_r84.wav",root:84,lo:0,hi:108,loop:1,ls:36638,le:51214}] },
    synth_bass_1: { label:"Synth Bass 1 (FluidR3, MIT)", dir:"synth_bass_1", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:45,loop:1,ls:8,le:409},{file:"z01_r57.wav",root:57,lo:46,hi:57,loop:1,ls:8,le:208},{file:"z02_r69.wav",root:69,lo:58,hi:69,loop:1,ls:9,le:109},{file:"z03_r81.wav",root:81,lo:70,hi:127,loop:1,ls:8,le:58}] },
    synth_bass_2: { label:"Synth Bass 2 (FluidR3, MIT)", dir:"synth_bass_2", sr:44100, zones:[{file:"z00_r36.wav",root:35.94,lo:0,hi:36,loop:1,ls:27715,le:28392},{file:"z01_r48.wav",root:47.97,lo:37,hi:48,loop:1,ls:12019,le:12357},{file:"z02_r60.wav",root:60.06,lo:49,hi:60,loop:1,ls:5728,le:5896},{file:"z03_r72.wav",root:72.06,lo:61,hi:96,loop:1,ls:2894,le:2978}] },
    synth_brass_1: { label:"Synth Brass 1 (FluidR3, MIT)", dir:"synth_brass_1", sr:44100, zones:[{file:"z00_r60.wav",root:60,lo:0,hi:60,loop:1,ls:56524,le:107853},{file:"z01_r72.wav",root:72,lo:61,hi:72,loop:1,ls:54746,le:129120},{file:"z02_r84.wav",root:84,lo:73,hi:127,loop:1,ls:66416,le:128768}] },
    synth_brass_2: { label:"Synth Brass 2 (FluidR3, MIT)", dir:"synth_brass_2", sr:44100, zones:[{file:"z00_r60.wav",root:59.97,lo:0,hi:60,loop:1,ls:56524,le:107853},{file:"z01_r72.wav",root:71.97,lo:61,hi:72,loop:1,ls:54746,le:129120},{file:"z02_r84.wav",root:83.97,lo:73,hi:127,loop:1,ls:66416,le:128768}] },
    synth_drum: { label:"Synth Drum (FluidR3, MIT)", dir:"synth_drum", sr:44100, zones:[{file:"z00_r41.wav",root:41,lo:0,hi:127,loop:0,ls:8,le:24386},{file:"z01_r41.wav",root:46,lo:0,hi:64,loop:1,ls:98,le:500},{file:"z02_r65.wav",root:70,lo:65,hi:88,loop:1,ls:52,le:252},{file:"z03_r89.wav",root:94,lo:89,hi:127,loop:1,ls:25,le:125}] },
    synth_strings_1: { label:"Synth Strings 1 (FluidR3, MIT)", dir:"synth_strings_1", sr:44100, zones:[{file:"z00_r45.wav",root:45,lo:0,hi:45,loop:1,ls:189,le:590},{file:"z01_r57.wav",root:57,lo:46,hi:57,loop:1,ls:93,le:294},{file:"z02_r69.wav",root:69,lo:58,hi:69,loop:1,ls:8,le:109},{file:"z03_r81.wav",root:81,lo:70,hi:96,loop:1,ls:125,le:175},{file:"z04_r84.wav",root:84.169,lo:97,hi:108,loop:1,ls:19277,le:45867}] },
    synth_strings_2: { label:"Synth Strings 2 (FluidR3, MIT)", dir:"synth_strings_2", sr:44100, zones:[{file:"z00_r69.wav",root:45,lo:0,hi:69,loop:1,ls:189,le:590},{file:"z01_r81.wav",root:57,lo:70,hi:81,loop:1,ls:93,le:294},{file:"z02_r93.wav",root:69,lo:82,hi:93,loop:1,ls:8,le:109},{file:"z03_r105.wav",root:80.96,lo:0,hi:127,loop:1,ls:125,le:175},{file:"z04_r105.wav",root:81,lo:94,hi:127,loop:1,ls:125,le:175}] },
    synth_voice: { label:"Synth Voice (FluidR3, MIT)", dir:"synth_voice", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:53,loop:1,ls:8557,le:45056},{file:"z01_r54.wav",root:54,lo:54,hi:59,loop:1,ls:32399,le:58210},{file:"z02_r66.wav",root:66.191,lo:66,hi:71,loop:1,ls:42289,le:80458},{file:"z03_r72.wav",root:72,lo:72,hi:77,loop:1,ls:21320,le:63630},{file:"z04_r84.wav",root:84,lo:84,hi:89,loop:1,ls:21530,le:42811},{file:"z05_r90.wav",root:90,lo:90,hi:127,loop:1,ls:17304,le:32713}] },
    timpani: { label:"Timpani (FluidR3, MIT)", dir:"timpani", sr:44100, zones:[{file:"z00_r36.wav",root:36,lo:0,hi:36,loop:0,ls:7,le:166621},{file:"z01_r38.wav",root:38,lo:37,hi:42,loop:0,ls:7,le:143671},{file:"z02_r43.wav",root:43,lo:43,hi:127,loop:0,ls:6,le:155038}] },
    tinker_bell: { label:"Tinker Bell (FluidR3, MIT)", dir:"tinker_bell", sr:44100, zones:[{file:"z00_r40.wav",root:40,lo:0,hi:49,loop:0,ls:8,le:6157},{file:"z01_r40.wav",root:40,lo:50,hi:61,loop:0,ls:8,le:6157},{file:"z02_r40.wav",root:40,lo:62,hi:73,loop:0,ls:8,le:6157},{file:"z03_r40.wav",root:40,lo:86,hi:97,loop:0,ls:8,le:6157},{file:"z04_r40.wav",root:40,lo:98,hi:102,loop:0,ls:8,le:6157},{file:"z05_r102.wav",root:40,lo:103,hi:108,loop:0,ls:8,le:6157}] },
    tremolo: { label:"Tremolo (FluidR3, MIT)", dir:"tremolo", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:56826,le:150523},{file:"z01_r40.wav",root:39.831,lo:38,hi:40,loop:1,ls:54138,le:140576},{file:"z02_r49.wav",root:49,lo:48,hi:51,loop:1,ls:75259,le:139523},{file:"z03_r64.wav",root:64.129,lo:63,hi:65,loop:1,ls:61102,le:159259},{file:"z04_r73.wav",root:73,lo:72,hi:74,loop:1,ls:14601,le:57396},{file:"z05_r83.wav",root:83,lo:82,hi:96,loop:1,ls:27892,le:59980}] },
    tubular_bells: { label:"Tubular Bells (FluidR3, MIT)", dir:"tubular_bells", sr:44100, zones:[{file:"z00_r84.wav",root:84.18,lo:0,hi:66,loop:1,ls:61072,le:62484},{file:"z01_r84.wav",root:84.18,lo:67,hi:75,loop:1,ls:61072,le:62484},{file:"z02_r84.wav",root:84.18,lo:76,hi:84,loop:1,ls:61072,le:62484},{file:"z03_r84.wav",root:84.18,lo:85,hi:94,loop:1,ls:61072,le:62484},{file:"z04_r84.wav",root:84.18,lo:95,hi:108,loop:1,ls:61072,le:62484}] },
    viola: { label:"Viola (FluidR3, MIT)", dir:"viola", sr:44100, zones:[{file:"z00_r49.wav",root:48.88,lo:0,hi:50,loop:1,ls:36843,le:45479},{file:"z01_r58.wav",root:57.72,lo:57,hi:59,loop:1,ls:49724,le:59159},{file:"z02_r67.wav",root:66.93,lo:66,hi:68,loop:1,ls:34406,le:42770},{file:"z03_r73.wav",root:72.763,lo:72,hi:74,loop:1,ls:51662,le:61506},{file:"z04_r82.wav",root:82,lo:81,hi:83,loop:1,ls:66055,le:73948},{file:"z05_r91.wav",root:91.32,lo:90,hi:96,loop:1,ls:53774,le:61846}] },
    violin: { label:"Violin (FluidR3, MIT)", dir:"violin", sr:44100, zones:[{file:"z00_r56.wav",root:55.85,lo:0,hi:58,loop:1,ls:55974,le:64117},{file:"z01_r65.wav",root:65,lo:65,hi:67,loop:1,ls:50770,le:59099},{file:"z02_r74.wav",root:74.157,lo:72,hi:74,loop:1,ls:67663,le:75312},{file:"z03_r83.wav",root:82.837,lo:81,hi:83,loop:1,ls:58675,le:66559},{file:"z04_r89.wav",root:88.954,lo:87,hi:89,loop:1,ls:50513,le:58174},{file:"z05_r98.wav",root:97.8,lo:97,hi:101,loop:1,ls:25376,le:33537}] },
    xylophone: { label:"Xylophone (FluidR3, MIT)", dir:"xylophone", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:0,ls:8,le:64161},{file:"z01_r66.wav",root:66,lo:66,hi:71,loop:0,ls:8,le:53880},{file:"z02_r78.wav",root:78,lo:78,hi:83,loop:0,ls:8,le:46584},{file:"z03_r84.wav",root:84,lo:84,hi:89,loop:0,ls:8,le:43952},{file:"z04_r96.wav",root:96,lo:96,hi:101,loop:0,ls:8,le:29160},{file:"z05_r108.wav",root:108,lo:108,hi:127,loop:0,ls:8,le:23032}] },
    yamaha_grand_piano: { label:"Yamaha Grand Piano (FluidR3, MIT)", dir:"yamaha_grand_piano", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z02_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z03_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z05_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
  };
  D.PERCBANK = { dir:"standard", sr:44100, hits:{
    sideStick:{file:"sideStick.wav",note:37,len:64000}, clap:{file:"clap.wav",note:39,len:16896},
    tambourine:{file:"tambourine.wav",note:54,len:22656}, cowbell:{file:"cowbell.wav",note:56,len:16960},
    vibraslap:{file:"vibraslap.wav",note:58,len:66849}, bongoHi:{file:"bongoHi.wav",note:60,len:13888},
    bongoLo:{file:"bongoLo.wav",note:61,len:17152}, congaMuteHi:{file:"congaMuteHi.wav",note:62,len:12032},
    congaOpenHi:{file:"congaOpenHi.wav",note:63,len:31261}, congaLo:{file:"congaLo.wav",note:64,len:28160},
    timbaleHi:{file:"timbaleHi.wav",note:65,len:65408}, timbaleLo:{file:"timbaleLo.wav",note:66,len:70656},
    agogoHi:{file:"agogoHi.wav",note:67,len:12395}, agogoLo:{file:"agogoLo.wav",note:68,len:17814},
    cabasa:{file:"cabasa.wav",note:69,len:7692}, maracas:{file:"maracas.wav",note:70,len:4614},
    guiroShort:{file:"guiroShort.wav",note:73,len:9413}, guiroLong:{file:"guiroLong.wav",note:74,len:22042},
    claves:{file:"claves.wav",note:75,len:4576}, woodblockHi:{file:"woodblockHi.wav",note:76,len:13376},
    woodblockLo:{file:"woodblockLo.wav",note:77,len:14336}, triangleMute:{file:"triangleMute.wav",note:80,len:72136},
    triangleOpen:{file:"triangleOpen.wav",note:81,len:72136}, shaker:{file:"shaker.wav",note:82,len:30428} } };
  if (typeof module !== "undefined" && module.exports) module.exports = D;
  else root.__REGISTRY = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
