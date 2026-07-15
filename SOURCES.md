# The media policy

**This repo ships recipes, not media.** Source is committed; audio, video, and
models are derived — fetched by the committed recipe scripts (`tools/fetch-*.sh`)
into gitignored directories (`found/`, `models/`) and fully regenerable. No
audio/video/model binary is ever committed; `verify.sh` and CI enforce it
(`.github/workflows/verify.yml`). What IS committed: fetch recipes, manifests,
cue catalogs (JSON timestamps/tags), decoded parameter data, and this ledger.

Three bright-line tiers for the material the recipes touch:

1. **PD / CC0 / MIT-licensed** (NASA, LibriVox, PD-marked aporee items,
   FluidR3 GM/GS, locally synthesized ffmpeg/espeak material) — free to fetch,
   remix, and include in anything. We still keep it fetch-only to keep the
   repo small.
2. **Attribution / ShareAlike / NonCommercial / NoDerivs CC material** (most
   aporee recordings, Naropa readings, OTRR wrappers, SRAA shortwave) —
   **fetch-only, personal playback**. Any *distributed render* inherits the
   per-item obligations flagged in the tables below (attribute, SA
   inheritance, NC, no ND derivatives) and needs a human release decision.
3. **Unlicensed commercial material** (the LaserDisc demo discs, Video Drug
   volumes, the "Skip to My Loops" sample CD, the unrecovered lib reels) —
   **never redistributed, in any form**: never committed, never in a packaged
   build, never in a distributed render. Stream/local-cache for personal
   viewing only; point people at the archive.org item and the recipe instead.

This file is the canonical attribution ledger (every item, every license,
every flag). The third-party CODE credits and license carve-outs live in
[NOTICE](NOTICE); the contributor-facing rules live in
[CONTRIBUTING.md](CONTRIBUTING.md).

# Found-sound sources & attribution

**Demoscene background layer** (`demo-layer.js`): the [MicroW8](https://github.com/exoticorn/microw8)
fantasy-console runtime + example carts (tunnel / plasma / fireworks / scener effects), vendored
under `vendor/microw8/`. MicroW8 by exoticorn — **Unlicense (public domain)**; see `vendor/microw8/UNLICENSE`.
`vendor/microw8/carts/` holds 32 carts: 8 are MicroW8's own example prods (exoticorn) from the
v0.4.1 release, the other 24 are classic size-coding effects (plasma / fire / metaballs / starfield /
kaleidoscope / rotozoom / Mandelbrot / bump / voxel-ish floor …) authored for this project in
CurlyWas and compiled with the MicroW8 `uw8` tool. All public domain (Unlicense).

The found-sound layer is **field recordings from [radio aporee ::: maps](https://aporee.org/maps/)**,
mirrored on the **Internet Archive**. The audio files themselves are **not committed** —
`fetch-found-sound.sh` downloads them and the engine's found-sound layer
(`engine/faust/found-player.js`) granular-processes them at play time
(time-stretched, pitched down, sent to the reverb).

aporee field recordings are generally licensed **CC BY-NC-SA**. Respect that for any
distribution: attribute, non-commercial, share-alike. This sketch is a personal /
illustrative render, not a release.

## Recordings used

| local name | Internet Archive item | content | currently layered |
|---|---|---|---|
| `tokyo_station` | [`aporee_20938_24294`](https://archive.org/details/aporee_20938_24294) — `nov19tokyostation1934.ogg` | Tokyo Station — metro voices, announcements, platform ambience | ✅ (vaporwave) |
| `highway_night` | [`aporee_44512_50607`](https://archive.org/details/aporee_44512_50607) — `soundmap201905198.mp3` (CC BY-NC-ND) | night highway, Kouhu Township, Yunlin County TW | ✅ (synthwave) |
| `factory` | [`aporee_63765_73460`](https://archive.org/details/aporee_63765_73460) (CC BY-NC-SA) | metallurgy plant, La Negra, Chile | genre-kernel: techno |
| `frogs` | [`aporee_61056_70186`](https://archive.org/details/aporee_61056_70186) (CC BY-NC-ND) | frog chorus, Nishiaizu, Fukushima | genre-kernel: jungle |
| `iriomote` | [`aporee_30783_35405`](https://archive.org/details/aporee_30783_35405) (public domain) | Iriomote Island day/night | genre-kernel: ambient/downtempo |
| `shibuya` | [`aporee_20542_23865`](https://archive.org/details/aporee_20542_23865) (CC BY-SA) | Udagawachō street walk, Shibuya | genre-kernel: house |
| `tw_intrain` | [`radio_aporee_log_2014_06_02_12_21_50`](https://archive.org/details/radio_aporee_log_2014_06_02_12_21_50) | aboard a train, Hagen Hbf — interior clatter | genre-kernel: transitwave |
| `tw_trains` | [`aporee_51245_58484`](https://archive.org/details/aporee_51245_58484) — `RailwayStationDivaaSlovenia.mp3` | passenger & cargo trains, Divača station, Slovenia | genre-kernel: transitwave |
| `tw_stationhall` | [`aporee_39219_48146`](https://archive.org/details/aporee_39219_48146) — `soundmap201812162.mp3` | walking into Taoyuan station hall, Taiwan | genre-kernel: transitwave |
| `tw_platform` | [`aporee_72529_84687`](https://archive.org/details/aporee_72529_84687) | Hastings railway station approach, UK | genre-kernel: transitwave |
| `tw_arrival` / `tw_pass` (one-shots) | [`aporee_9730_11655`](https://archive.org/details/aporee_9730_11655) — `CuteffectMuggenhof.mp3` | a train passing, Muggenhof, Nuremberg — trimmed to two one-shots in `fetch-found-samples.sh` | genre-kernel: transitwave |

The transitwave station-PA voice (train-schedule announcements + the departures litany)
is **synthesized** with `espeak-ng` through a telephone-band filter — see the
`saytransit` recipes in `fetch-found-samples.sh`. Not a found recording.

## Bed-pool expansion (repertoire wave 3, 2026-07-10)

79 field-recording beds from radio aporee ::: maps (archive.org mirrors),
curated into ten character classes for the bed-POOL law (`genre-kernel.js`
`SOURCE_POOLS`; recipe: `tools/fetch-bed-expansion.sh`). **Permissive licenses
only** (PD Mark / BY / BY-SA), each verified against its item's live
archive.org `licenseurl` metadata on 2026-07-10 — stricter than the original
corpus above (zero NC, zero ND). **Flag for the human release decision:** BY
items require attribution in any distributed render; BY-SA items additionally
inherit ShareAlike. The three bird-forward night beds (`berlin_dawn_fox`,
`kruger_dawn`, `mull_night`) are registered but join NO general pool (the
bird-rarity law).

| local name | class | Internet Archive item | content | license |
|---|---|---|---|---|
| `empress_market` | city air | [`aporee_33725_38795`](https://archive.org/details/aporee_33725_38795) — `EmperessMarketEdited.mp3` | circular binaural walk through Karachi's Empress Market — vendor calls over a deep crowd rumble | **CC Public Domain Mark 1.0** |
| `xanthi_bazaar` | city air | [`aporee_30735_35347`](https://archive.org/details/aporee_30735_35347) — `Bigbazaarambience.mp3` | Saturday-morning bazaar in full cry, Xanthi GR — layered hawkers and crowd | **CC BY** |
| `tunis_souk` | city air | [`aporee_56148_64205`](https://archive.org/details/aporee_56148_64205) — `TunisSoukchant.mp3` | souk walk with a distant chant, Tunis medina | **CC Public Domain Mark 1.0** |
| `marrakesh_forge` | city air | [`aporee_22317_25900`](https://archive.org/details/aporee_22317_25900) — `marrakeshMedinaBlacksmith140226.mp3` | blacksmith hammering deep inside the Haddadine metalworkers' souk, Marrakesh | **CC BY** |
| `brighton_arcade` | city air | [`aporee_27514_31721`](https://archive.org/details/aporee_27514_31721) — `BrightonPierarcade.mp3` | penny-arcade sensory overload on Brighton Pier — chimes, coins, holy noise | **CC Public Domain Mark 1.0** |
| `vegas_casino` | city air | [`aporee_21167_24591`](https://archive.org/details/aporee_21167_24591) — `lasvegascasino.mp3` | binaural casino floor, Las Vegas Strip — slot chimes over the HVAC wash | **CC Public Domain Mark 1.0** |
| `nyc_subway` | city air | [`aporee_21691_25214`](https://archive.org/details/aporee_21691_25214) — `032140215173333.mp3` | Times Square station entrance hall — pedestrians, a piano, the ticket-counter voice | **CC Public Domain Mark 1.0** |
| `bart_last_train` | city air | [`aporee_18542_21525`](https://archive.org/details/aporee_18542_21525) — `LastBARTMacArthur.mp3` | the last BART of the night, a car full of Friday revelers — MacArthur, Oakland | **CC Public Domain Mark 1.0** |
| `budapest_escalator` | city air | [`aporee_34266_39393`](https://archive.org/details/aporee_34266_39393) — `DeakFerenczTerescelator.mp3` | the fast old M3 escalators at Deák Ferenc tér, a train leaving below | **CC Public Domain Mark 1.0** |
| `schoolyard_break` | city air | [`aporee_27924_32185`](https://archive.org/details/aporee_27924_32185) — `GrundschuleLlsdorf.mp3` | schoolyard break — children to the right of the mic, cars to the left, Niederkassel DE | **CC Public Domain Mark 1.0** |
| `playground_amsterdam` | city air | [`aporee_19823_23031`](https://archive.org/details/aporee_19823_23031) — `STE0012KinderspeelplaatsHendrik27092013.mp3` | Friday-afternoon playground crowd, Amsterdam Zuid | **CC Public Domain Mark 1.0** |
| `keelung_fishmarket` | city air | [`aporee_17407_20260`](https://archive.org/details/aporee_17407_20260) — `Soundmap2012062452.mp3` | Keelung fish market — calls, ice, scales | **CC BY** |
| `beitou_night_traffic` | road hum | [`aporee_20245_23563`](https://archive.org/details/aporee_20245_23563) — `SoundMap201311026.mp3` | night traffic from a convenience-store doorway, Beitou Taipei | **CC Public Domain Mark 1.0** |
| `morning_traffic_ny` | road hum | [`aporee_14133_16462`](https://archive.org/details/aporee_14133_16462) — `guilderlandtraffic.mp3` | arterial morning traffic from a parking lot, a radio far off — Guilderland NY | **CC Public Domain Mark 1.0** |
| `cairo_traffic_jam` | road hum | [`aporee_13530_15782`](https://archive.org/details/aporee_13530_15782) — `alazharstreet.mp3` | inside a cab in a Cairo jam — horns, idling engine, motorcycles threading through | **CC BY** |
| `blizzard_freight` | road hum | [`aporee_30574_35173`](https://archive.org/details/aporee_30574_35173) — `FreightTrainSnowstorm.mp3` | a freight train grinding through a blizzard, Colorado Springs | **CC BY** |
| `snow_highway` | road hum | [`aporee_30577_35176`](https://archive.org/details/aporee_30577_35176) — `I25PedestrianBridgeSnowTREAT.mp3` | I-25 under snow from a pedestrian bridge — muffled highway hiss | **CC BY** |
| `porto_tram` | road hum | [`aporee_20129_23437`](https://archive.org/details/aporee_20129_23437) — `tramone.mp3` | old tram car trembling and crackling down line 1, murmuring passengers — Porto | **CC Public Domain Mark 1.0** |
| `bratislava_trainyard` | road hum | [`aporee_48325_54967`](https://archive.org/details/aporee_48325_54967) — `201603242133Ruchaposun.mp3` | night shunting in the Bratislava yard — horn, couplers, commands on a worker's radio | **CC BY** |
| `coldharbour_mill` | machine room | [`aporee_16852_19600`](https://archive.org/details/aporee_16852_19600) — `21042009coldharbourmill01.mp3` | Victorian spinning machinery still making yarn, Coldharbour Mill, Devon | **CC BY-SA ⚠ SA** |
| `litho_press` | machine room | [`aporee_25084_30610`](https://archive.org/details/aporee_25084_30610) — `B12h33m27s02oct2014oldprintingpress.mp3` | an early-1900s litho press, big clunky metal parts — Williams Press, Berkshire | **CC BY-SA ⚠ SA** |
| `zaandam_sawmill` | machine room | [`aporee_54394_62217`](https://archive.org/details/aporee_54394_62217) — `zaandampila.mp3` | inside a wind-powered wooden sawmill, Het Jonge Schaap, Zaanse Schans | **CC Public Domain Mark 1.0** |
| `hydro_turbine` | machine room | [`aporee_13260_15495`](https://archive.org/details/aporee_13260_15495) — `elektrine.mp3` | turbine and falling water at a small hydro dam, Užpaliai LT | **CC Public Domain Mark 1.0** |
| `wind_turbine_motor` | machine room | [`aporee_34689_39885`](https://archive.org/details/aporee_34689_39885) — `CAPSEoliennemoteurcricket.mp3` | a wind turbine's yaw motor turning the axis, crickets underneath — Bouin FR | **CC Public Domain Mark 1.0** |
| `grinding_plant` | machine room | [`aporee_14900_17371`](https://archive.org/details/aporee_14900_17371) — `besidegrinder.mp3` | coal lumps ground to a uniform size at the Nástup mine, Kadaň CZ | **CC Public Domain Mark 1.0** |
| `pumping_station` | machine room | [`aporee_47462_53934`](https://archive.org/details/aporee_47462_53934) — `FobneyVictorianpumpingstation.mp3` | inside a locked Victorian canal pumping station, Fobney Lock, Reading | **CC Public Domain Mark 1.0** |
| `ice_machine` | machine room | [`aporee_16196_18783`](https://archive.org/details/aporee_16196_18783) — `DusseldorfEisstadionEiswagenNeumannb.mp3` | the ice machine circling the old Düsseldorf ice stadium | **CC Public Domain Mark 1.0** |
| `silo_resonance` | machine room | [`aporee_13729_16009`](https://archive.org/details/aporee_13729_16009) — `mariborMehlmuehleSilos290512.mp3` | interfering machine drones in a flour-mill silo hall, Maribor | **CC BY-SA ⚠ SA** |
| `pulkovo_pa` | voices on tape | [`aporee_52884_60425`](https://archive.org/details/aporee_52884_60425) — `610eBIPETERSBURGairportannouncenemtssoundwalking190904003.mp3` | airport announcements drifting over a binaural soundwalk, Pulkovo, St Petersburg | **CC Public Domain Mark 1.0** |
| `kaohsiung_pa` | voices on tape | [`aporee_18791_21802`](https://archive.org/details/aporee_18791_21802) — `SoundMap2012032942.mp3` | station broadcast messages beside a cooling tank at night, Kaohsiung | **CC Public Domain Mark 1.0** |
| `leeds_terrace` | voices on tape | [`aporee_31056_35699`](https://archive.org/details/aporee_31056_35699) — `LeedsUnitedGameSR004BinauraleditedConverted.mp3` | the Elland Road terraces, last match of the season — chants and roars | **CC Public Domain Mark 1.0** |
| `celtic_fans` | voices on tape | [`aporee_7691_9439`](https://archive.org/details/aporee_7691_9439) — `BloemfonteinCelticSupportersOct2009.mp3` | Bloemfontein Celtic supporters singing the stadium into one voice | **CC BY-SA ⚠ SA** |
| `nevsky_choir` | voices on tape | [`aporee_30388_34974`](https://archive.org/details/aporee_30388_34974) — `LordhavemercyAlexanderNevskyMonastery.mp3` | 'Lord have mercy' sung in the Alexander Nevsky Monastery, St Petersburg | **CC BY-SA ⚠ SA** |
| `oslo_ferry_pa` | voices on tape | [`aporee_14593_16997`](https://archive.org/details/aporee_14593_16997) — `FahrenachOsloAnkunftAnsage.mp3` | the arrival announcement in German and English aboard the Kiel–Oslo ferry | **CC Public Domain Mark 1.0** |
| `coyote_prairie` | night air | [`aporee_38611_44124`](https://archive.org/details/aporee_38611_44124) — `215141felixblumeacoyoteishowlingduringthenightinthetallgrassprairieoklahomausa.mp3` | a coyote howling at night on the Tall Grass Prairie as a plane passes, crickets under | **CC Public Domain Mark 1.0** |
| `tepoztlan_cricket` | night air | [`aporee_43806_49863`](https://archive.org/details/aporee_43806_49863) — `GrilloTEP130102T05RxNoise.mp3` | one cricket close up; village dogs and a far church bell — Tepoztlán MX | **CC Public Domain Mark 1.0** |
| `nj_owls` | night air | [`aporee_28200_32491`](https://archive.org/details/aporee_28200_32491) — `06Track6.mp3` | great horned owls over an insect drone, south-Jersey pine flats | **CC Public Domain Mark 1.0** |
| `mugla_cicadas` | night air | [`aporee_37508_42950`](https://archive.org/details/aporee_37508_42950) — `07312306391trim.mp3` | beach-camp cicadas after dark, Muğla TR | **CC Public Domain Mark 1.0** |
| `berlin_dawn_fox` | night air | [`aporee_48991_55788`](https://archive.org/details/aporee_48991_55788) — `DawnchorusFriedhofColumbiadammedit.mp3` | dawn chorus with fox barks and a nightingale, Berlin cemetery (bird-forward — no general pool) | **CC Public Domain Mark 1.0** |
| `kruger_dawn` | night air | [`aporee_33795_38875`](https://archive.org/details/aporee_33795_38875) — `TsendzeRusticCampsite.mp3` | first light in Kruger Park — ground hornbills and hippos (bird-forward — no general pool) | **CC Public Domain Mark 1.0** |
| `mull_night` | night air | [`aporee_47362_53818`](https://archive.org/details/aporee_47362_53818) — `NightCurlewandHeronwithfirtrees.mp3` | curlew and grey heron at night, pines singing in the breeze, Isle of Mull (bird-forward — no general pool) | **CC Public Domain Mark 1.0** |
| `ibis_evening` | night air | [`aporee_19043_22382`](https://archive.org/details/aporee_19043_22382) — `IbisEvening.mp3` | amphibian chorus at an ibis house, moonless Florida night | **CC Public Domain Mark 1.0** |
| `swamp_underwater` | deep water | [`aporee_19431_22572`](https://archive.org/details/aporee_19431_22572) — `hidrofonasaporee1.mp3` | hydrophone in an autumn swamp, Utena LT — the tick and fizz of pond life | **CC Public Domain Mark 1.0** |
| `underwater_mechanica` | deep water | [`aporee_23818_27676`](https://archive.org/details/aporee_23818_27676) — `underwatermechanika.mp3` | an unexplained underwater machine rhythm in a swamp, traffic bleeding through | **CC Public Domain Mark 1.0** |
| `weir_underwater` | deep water | [`aporee_30821_35445`](https://archive.org/details/aporee_30821_35445) — `hydropwier.mp3` | hydrophone under a swollen mill weir, Colchester | **CC Public Domain Mark 1.0** |
| `glacier_melt` | deep water | [`aporee_64980_75062`](https://archive.org/details/aporee_64980_75062) — `2407100485frammAporee.mp3` | flow-borne hydrophones riding glacier meltwater streams, Svalbard | **CC Public Domain Mark 1.0** |
| `pebble_surf` | deep water | [`aporee_13421_15669`](https://archive.org/details/aporee_13421_15669) — `11100803edit.mp3` | surf raking a pebble beach, Corfu | **CC BY** |
| `winter_surf` | deep water | [`aporee_15707_18266`](https://archive.org/details/aporee_15707_18266) — `StrandNov2712.mp3` | glassy chest-high winter surf, no wind — Silver Strand CA | **CC Public Domain Mark 1.0** |
| `night_beach` | deep water | [`aporee_22007_25563`](https://archive.org/details/aporee_22007_25563) — `NocturnalBeachScheveningen.mp3` | an empty nocturnal beach, Scheveningen after dark | **CC Public Domain Mark 1.0** |
| `sealion_traffic` | deep water | [`aporee_69662_81117`](https://archive.org/details/aporee_69662_81117) — `sealionsboatsnarrows914.mp3` | sea lions barking on the narrows buoy, a boat passing — from a kayak, Alaska | **CC Public Domain Mark 1.0** |
| `office_predawn` | room tone | [`aporee_16161_22114`](https://archive.org/details/aporee_16161_22114) — `officee.mp3` | a help-desk room half an hour before opening — computers, water cooler, idling printer | **CC Public Domain Mark 1.0** |
| `kitchen_fridge` | room tone | [`aporee_13335_15645`](https://archive.org/details/aporee_13335_15645) — `lodowa.mp3` | recorder behind the fridge — casing cracks, coolant drips, a wonderful low drone | **CC Public Domain Mark 1.0** |
| `oil_boiler` | room tone | [`aporee_56425_64543`](https://archive.org/details/aporee_56425_64543) — `domesticoilboiler.mp3` | an old domestic oil boiler firing up and calming down, Suffolk | **CC Public Domain Mark 1.0** |
| `maat_boiler` | room tone | [`aporee_64588_74537`](https://archive.org/details/aporee_64588_74537) — `1167aBILISBOAMAATelectrictyboilerroom2404201735.mp3` | the boiler room of a former coal power plant, MAAT Lisbon | **CC Public Domain Mark 1.0** |
| `seedvault_tunnel` | room tone | [`aporee_9378_11274`](https://archive.org/details/aporee_9378_11274) — `seedvaultalarmbeepventfan.mp3` | alarm tone and HVAC fans in the Svalbard Seed Vault utility tunnel | **CC BY-SA ⚠ SA** |
| `platform_vent` | room tone | [`aporee_32401_37255`](https://archive.org/details/aporee_32401_37255) — `bremenHbfGleis8Ventilation160605.mp3` | exhaust-fan drone on platform 8, Bremen Hauptbahnhof | **CC BY-SA ⚠ SA** |
| `mills_elevator` | room tone | [`aporee_41528_47359`](https://archive.org/details/aporee_41528_47359) — `oaklandMillsMusicDepartmentElevator10162018.mp3` | riding a busy music-hall elevator, Mills College, Oakland | **CC Public Domain Mark 1.0** |
| `krabi_thunder` | weather | [`aporee_41798_47650`](https://archive.org/details/aporee_41798_47650) — `RainandthunderinThailandTH181001T01.mp3` | monsoon rain and rolling thunder over a small Thai village | **CC Public Domain Mark 1.0** |
| `geres_thunder` | weather | [`aporee_41611_47443`](https://archive.org/details/aporee_41611_47443) — `THUNDERSTORM.mp3` | a 4am thunderstorm in the distance, crickets, owls, occasional dogs — Peneda-Gerês | **CC Public Domain Mark 1.0** |
| `queens_thunder` | weather | [`aporee_46275_52573`](https://archive.org/details/aporee_46275_52573) — `RainandDistantThunderstorm.mp3` | heavy rain with a distant thunderstorm, Ridgewood Queens | **CC BY** |
| `istanbul_storm` | weather | [`aporee_8182_9955`](https://archive.org/details/aporee_8182_9955) — `nahendesgewitter.mp3` | a thunderstorm gathering over the Bosphorus before it strikes the city | **CC BY-SA ⚠ SA** |
| `kielce_rain` | weather | [`aporee_19222_22313`](https://archive.org/details/aporee_19222_22313) — `STE00255.mp3` | the onset of heavy rain in a restaurant park — voices in duet with the percussion | **CC Public Domain Mark 1.0** |
| `queens_blizzard` | weather | [`aporee_55553_63498`](https://archive.org/details/aporee_55553_63498) — `BlizzardNightRidgewoodQueens.mp3` | blizzard winds before dawn, snowplows working the street — Queens | **CC BY** |
| `shetland_storm` | weather | [`aporee_58995_67701`](https://archive.org/details/aporee_58995_67701) — `CarolineSimpsonsHousestorm1.mp3` | a storm heard from inside the house — rain on glass, muffled chat, Shetland | **CC BY-SA ⚠ SA** |
| `lighthouse_storm` | weather | [`aporee_43160_49192`](https://archive.org/details/aporee_43160_49192) — `160319sanisidrolighthouse.mp3` | wind at the southernmost lighthouse on the continent, Strait of Magellan | **CC Public Domain Mark 1.0** |
| `grenoble_wind` | weather | [`aporee_30729_35341`](https://archive.org/details/aporee_30729_35341) — `ventARLEQUIN.mp3` | the wind set singing by a slit under a door, like the mouth of an organ pipe | **CC Public Domain Mark 1.0** |
| `cordes_bells` | smalltown | [`aporee_68104_78862`](https://archive.org/details/aporee_68104_78862) — `Cordessurcielpigeonglise.mp3` | pigeons, church bells and far-away voices in a hilltop village square, Tarn FR | **CC Public Domain Mark 1.0** |
| `brugge_bells` | smalltown | [`aporee_31799_36524`](https://archive.org/details/aporee_31799_36524) — `bruggeolv.mp3` | the solo of the biggest bell, recorded inside the Bruges church tower | **CC BY** |
| `stjosef_bells` | smalltown | [`aporee_27760_31992`](https://archive.org/details/aporee_27760_31992) — `20150421StJosefinOhligs.mp3` | the 7am bells of St. Josef over light traffic, Solingen-Ohligs | **CC Public Domain Mark 1.0** |
| `sunday_bell` | smalltown | [`aporee_26388_30478`](https://archive.org/details/aporee_26388_30478) — `ChurchBellsJaneiroDeBaixo.mp3` | the village priest hand-ringing the Sunday bell (and enjoying it), Janeiro de Baixo PT | **CC Public Domain Mark 1.0** |
| `calgary_noon` | smalltown | [`aporee_30896_35526`](https://archive.org/details/aporee_30896_35526) — `NoonBellsintheStairway.mp3` | the noon carillon heard down the Calgary Tower emergency stairwell | **CC Public Domain Mark 1.0** |
| `brocante_bells` | smalltown | [`aporee_24286_28194`](https://archive.org/details/aporee_24286_28194) — `Bourgueilbrocantebells.mp3` | church bells tolling a tune over a small-town antiques market, Bourgueil FR | **CC Public Domain Mark 1.0** |
| `tongluo_market` | smalltown | [`aporee_35408_40667`](https://archive.org/details/aporee_35408_40667) — `soundmap201702169.mp3` | small-town market selling-calls and passing traffic, Tongluo TW | **CC BY** |
| `taranto_storm_bells` | smalltown | [`aporee_21030_24432`](https://archive.org/details/aporee_21030_24432) — `TramontoneWindRainBellsedit.mp3` | a St. Stephen's day storm from inside a flat, church bells playing far away — Taranto | **CC Public Domain Mark 1.0** |
| `kintai_shortwave` | shortwave | [`aporee_57712_66065`](https://archive.org/details/aporee_57712_66065) — `swinKintai.mp3` | tuning a shortwave radio at an artist residency, Kintai LT (anti-phase stereo: single-channel take) | **CC Public Domain Mark 1.0** |
| `wendover_shortwave` | shortwave | [`aporee_6463_8010`](https://archive.org/details/aporee_6463_8010) — `17shortwavewendoverUT.mp3` | shortwave reception on the fringe of the edge of the known world, Wendover UT | **CC BY-SA ⚠ SA** |
| `bridge_vlf` | shortwave | [`aporee_62035_71384`](https://archive.org/details/aporee_62035_71384) — `UnderBR1railway20231108114318.mp3` | railway electrics heard as VLF radio under a bridge, St Petersburg | **CC BY-SA ⚠ SA** |
| `power_em` | shortwave | [`aporee_39991_45685`](https://archive.org/details/aporee_39991_45685) — `antaliepteshespriezor2.mp3` | power-station motors heard through an electromagnetic listening antenna, Antalieptė LT | **CC Public Domain Mark 1.0** |
| `harbour_interference` | shortwave | [`aporee_28537_32885`](https://archive.org/details/aporee_28537_32885) — `RadioInterferenceBallsHead.mp3` | unexplained radio interference stalking a harbour-park recording, Sydney | **CC BY-SA ⚠ SA** |

Pipeline note (`kintai_shortwave`): the item's stereo channels are anti-phase;
a plain `-ac 1` downmix cancels to −57 dB. The fetch script's `getbed1` takes
channel 0 instead (verified −18 LUFS out). If any other bed ever comes out
silent, check downmix cancellation first.

## Recordings used historically (available to re-layer)

These appeared in earlier versions of the arrangement (as solo interludes /
transitions) and are wired as commented entries in `fetch-found-sound.sh`:

| local name | Internet Archive item |
|---|---|
| `tsukiji` | [`aporee_35166_40406`](https://archive.org/details/aporee_35166_40406) |
| `asakusa` | [`aporee_21091_24510`](https://archive.org/details/aporee_21091_24510) |
| a Paris market recording | (aporee) |

To re-introduce one: uncomment its line in `fetch-found-sound.sh` (fill in the
`.ogg` filename from the item's file list), reference it from a genre's `found`
sources in `engine/genre-kernel.js`, and re-render.

# Found-video sources & attribution

The background video layer (`video-layer.js`) plays short clips from **LaserDisc
rips on the Internet Archive**. Since 2026-07 the LIVE layer **streams** them
straight from archive.org (no pre-bake): the committed source is
`found/video/stream-catalog.json` — `{item, file, in, out}` cue windows + genre
tags (the `name` = clip id = `GENRE_CLIPS` key = local cache basename). It is the
one file under `found/` that is committed (whitelisted in `found/.gitignore`);
everything else there stays derived/gitignored. `fetch-found-video.sh` /
`cut-lib-clips.sh` are now a **cache / fallback builder** — they bake the same
windows to small silent 640px MP4s in `found/video/` for the slow-network /
archive-blocked fallback tier and for the offline renderers (`render-sample-video.js`,
`journey --video`), which don't stream. The clips themselves are **not committed**.
Timestamps were hand-curated by sampling frames across each disc (2026-06); the
`found/video/lib/` reels (item slugs unrecovered — see below) are **local-only**
(`item:null` in the catalog) and appear live only when cached locally.

| Internet Archive item | disc | clips | license |
|---|---|---|---|
| [`laser-vision-demonstration-1986`](https://archive.org/details/laser-vision-demonstration-1986) | LaserVision Demonstration (1986) | disc-as-sunset, bamboo forest, blue studio dinner | none stated |
| [`pioneer-laser-optics-ii-laserdisc`](https://archive.org/details/pioneer-laser-optics-ii-laserdisc) | Pioneer Laser Optics II demo (1989) | riders across a giant sun, chrome type over a skyline, Symbolics CGI | none stated |
| [`video-drug-2-phuture-laser-disc-1990`](https://archive.org/details/video-drug-2-phuture-laser-disc-1990) | Video Drug 2: Phuture (1990, JP ambient video) | kaleidoscope, red lattice, rainbow rings, green nebula, blue electric tracery, night-light kaleidoscope | none stated |
| [`video-drug-1-deep-laser-disc-1990`](https://archive.org/details/video-drug-1-deep-laser-disc-1990) | Video Drug 1: Deep (1990) | monochrome face collage, static-glitch face, TV in a dark red room | none stated |
| [`ss098-0001`](https://archive.org/details/ss098-0001) | NASA SpaceDisc Vol. 1 (1984) | Earth from orbit, STS spacewalk | NASA footage — public domain |
| [`tokyo-night-drive-4-k-2016`](https://archive.org/details/tokyo-night-drive-4-k-2016) | Tokyo Night Drive 首都高 (2016) | blue-hour expressway, dusk highway, Rainbow Bridge | public domain |
| [`from-SF`](https://archive.org/details/from-SF) | Night drive from SF | taillights at an intersection | public domain |
| [`201359_Subways`](https://archive.org/details/201359_Subways) | The Wreck of the NY Subways (Newsreel, 1970) | NYC subway platform, train, terminal — transitwave | newsreel |
| [`0845_Last_Clear_Chance_The_08_29_26_00`](https://archive.org/details/0845_Last_Clear_Chance_The_08_29_26_00) | Last Clear Chance (1959, Prelinger) | express train speeding, the rails — transitwave | Prelinger Archives |
| [`HMIronHorseRamble98234`](https://archive.org/details/HMIronHorseRamble98234) | Iron Horse Ramble, Reading RR (home movie, 1960) | from the train — transitwave | home movie |
| [`098243`](https://archive.org/details/098243) | PA rail fan: Dearborn station (home movie, 1960–61) | station platform & concourse — transitwave | home movie |

### REPERTOIRE wave 3 (2026-07-10) — the de-clone fetch

47 clips from 21 archive.org items (Prelinger unless noted), curated to break the
night-city/space/abstract skew: weather/storms, volcano fire, snow, crowds and
funfairs, dance-hall soundies, neon signage, desert road, nature macro,
steelmaking, printing, textile mills, atomic-age animation. Cue windows
hand-picked from frame contact sheets; URLs HEAD-checked (200 + range 206);
licenses read from item metadata 2026-07-10.

| Internet Archive item | film | clips | license |
|---|---|---|---|
| [`tornado`](https://archive.org/details/tornado) | Tornado (ca. 1950s) | funnel over the town, storm horizon | CC PD mark |
| [`ShockTro1938`](https://archive.org/details/ShockTro1938) | Shock Troops of Disaster (1938, WPA) | storm surge, waves through wreckage, fog figures | CC PD mark |
| [`0315_Plow_that_Broke_the_Plains_The_16_38_41_28`](https://archive.org/details/0315_Plow_that_Broke_the_Plains_The_16_38_41_28) | The Plow that Broke the Plains (1936) | the dust front | US federal film — public domain |
| [`volcanoes`](https://archive.org/details/volcanoes) | Volcanoes (Kilauea, color) | lava river, wall of fire, ash fountains | CC PD mark |
| [`2096_Tacoma-Narrows_Bridge_Collapse_03_11_13_15`](https://archive.org/details/2096_Tacoma-Narrows_Bridge_Collapse_03_11_13_15) | Tacoma Narrows Bridge Collapse (1940) | the galloping deck, the fall | Prelinger, no known restrictions |
| [`Wathenco1944`](https://archive.org/details/Wathenco1944) | Wathen home movie (1944, Kodachrome) | buried cars, church tower, snowed-in lanes, Coney rides | CC PD mark |
| [`ConeyIsl1940`](https://archive.org/details/ConeyIsl1940) | Coney Island (1940) | surf crowds, boardwalk, Wonder Wheel, Cyclone, Luna Park neon | CC PD mark |
| [`0432_Carnival_01_11_31_00`](https://archive.org/details/0432_Carnival_01_11_31_00) | Carnival | the carousel | Prelinger, no known restrictions |
| [`soundie_12`](https://archive.org/details/soundie_12) | Soundie: Hollywood Boogie (1946) | the all-girl big band | CC PD mark |
| [`SoundieD`](https://archive.org/details/SoundieD) | Soundie: Zig Me Baby with a Gentle Zag (1941) | ballroom couple, band in silhouette | CC PD mark |
| [`SoundieF`](https://archive.org/details/SoundieF) | Soundie: Reg Kehoe and his Marimba Queens (ca. 1940) | marimba orchestra, wild slap bass | CC PD mark |
| [`0838_Musical_Review_11_Louis_Armstrong_Soundie_11_33_03_18`](https://archive.org/details/0838_Musical_Review_11_Louis_Armstrong_Soundie_11_33_03_18) | Musical Review #11 (ca. 1942) | Louis Armstrong's trumpet, the band swings | Prelinger, no known restrictions |
| [`098461`](https://archive.org/details/098461) | Home movie: New York 1965 | Times Square neon canyon, Broadway signs | Prelinger home movies |
| [`010112-001`](https://archive.org/details/010112-001) | Home movie: Las Vegas road trip (1950s) | Fremont St casino neon, Thunderbird/Dunes neon, desert highway | Prelinger home movies |
| [`bees_and_spiders`](https://archive.org/details/bees_and_spiders) | Bees and Spiders (1927) | the swarming hive, dew on the web | Prelinger/ephemera, no known restrictions |
| [`200634_The_Growth_of_Plants`](https://archive.org/details/200634_The_Growth_of_Plants) | The Growth of Plants | time-lapse roots, seedlings, a flower opens | Prelinger, no known restrictions |
| [`steel_the_hardest_metal`](https://archive.org/details/steel_the_hardest_metal) | Industries of the US: Steel (1931, Pathé) | pig iron pour, furnace face, steel curls | CC PD mark |
| [`Printing1947`](https://archive.org/details/Printing1947) | Printing (1947) | the linotype line, the press run | CC PD mark |
| [`0333HowTextileMillsAreModernizing`](https://archive.org/details/0333HowTextileMillsAreModernizing) | How Textile Mills Are Modernizing (1948) | spinning frames, knitters, the loom | Prelinger, no known restrictions |
| [`0159_A_is_for_Atom_01_00_48_00`](https://archive.org/details/0159_A_is_for_Atom_01_00_48_00) | A is for Atom (1953, GE) | electron orbits, the glowing giant | Prelinger, no known restrictions |
| [`6143_Wonder_World_of_Chemistry_A_Film_Story_of_Better_Things_for_Bet_01_19_13_16`](https://archive.org/details/6143_Wonder_World_of_Chemistry_A_Film_Story_of_Better_Things_for_Bet_01_19_13_16) | Wonder World of Chemistry (1936, Du Pont) | the apothecary wall | Prelinger, no known restrictions |

The NASA material is public domain. The demo discs and Video Drug volumes carry
no explicit license; they're used here as brief, transformed, muted excerpts in
a non-commercial art context. Don't redistribute the clips as media — point
people at the recipe and the Archive items instead.

## Found-video *library* (found/video/lib/ — cut-lib-clips.sh)

A second batch of full-length reels was fetched into `found/video/lib/`
(gitignored, ~525 MB) **without** a fetch recipe or cue manifest. `cut-lib-clips.sh`
is the committed recipe that cues them: it cuts a handful of short, silent, 640px
windows per reel into `found/video/`, merges them into `found/video/clips.json`,
and writes `found/video/lib/segments.json` (in/out + genre-affinity tags for the
`genre-kernel.js` `GENRE_CLIPS` pools). Run it after `fetch-found-video.sh`.

The reels arrived without their Internet Archive item ids; the **films are
identified from frame inspection** (confident where noted) but the **exact
archive.org item slugs were not recoverable** — recover them before any
redistribution. Cut windows deliberately avoid title cards, black, and (for the
wartime anime) militaristic/propaganda shots; burned-in subtitles are cropped
off the anime.

| lib reel | film (identified) | clips | license status |
|---|---|---|---|
| `3dgfx_computer_made_movies` | Computer-Made Movies — Bell Labs early CGI, incl. E. Zajac's "Two-Gyro Gravity-Gradient Attitude Control System" (1963, the first computer-generated film) | `cmm_wireglobe`, `cmm_gyrobox`, `cmm_crescent` | PD-adjacent (Bell Labs / US-gov ephemeral) — **verify**; archive.org id not recovered |
| `3dgfx_incredible_machine` | The Incredible Machine — Bell Telephone Laboratories (1968) | `im_pixeltext`, `im_paint`, `im_redroom`, `im_scope` | PD-adjacent (Bell Labs / AT&T promotional) — **verify**; archive.org id not recovered |
| `3dgfx_jupiter_magnetosphere` | Jupiter's Magnetosphere — The Movie (scientific field-line viz, 1980s est.) | `jm_dipole`, `jm_axis`, `jm_flux` | likely NASA/university PD — **verify**; archive.org id not recovered |
| `3dgfx_losalamos_sims_1975` | Los Alamos computer simulations (c.1975; card credits advisors Newell / Elliott / Pequette / Orr) | `la_mesh1`, `la_meshvase`, `la_mesh2` | likely US-gov (LANL) PD — **verify**; archive.org id not recovered |
| `anime_momotaro_shinpei` | Momotaro: Umi no Shinpei (Momotaro's Divine Sea Warriors, 1945, dir. Mitsuyo Seo) — first Japanese feature-length animation | `mo_singalong`, `mo_pastoral`, `mo_dance` | public domain by age (Japan). ⚠ WWII-era; only non-militaristic windows cued, subtitles cropped |
| `anime_momotaro_umiwashi` | Momotaro no Umiwashi (Momotaro's Sea Eagles, 1943) | **DELETED 2026-07-04** | Reel deleted from `found/video/lib/` — explicit WWII air-raid propaganda + a racial-caricature character; never cued into the clip pool. Re-fetch from archive.org (item slug unrecovered) only if genuinely needed. |

These reels carry no explicit machine-readable license and (the anime) sensitive
wartime content; treat them exactly like the demo discs above — brief, muted,
transformed, non-commercial excerpts only, and recover provenance before release.

# Voice / radio / poetry sources & attribution

The found-voice layer (`found/vx_*.wav`) is talking, poetry, old radio, numbers
stations and time signals from the **Internet Archive**. Not committed —
`fetch-found-voice.sh` is the committed recipe (curl + ffmpeg trim to ≤90s mono
44.1k). Licenses vary **per item**; ND-licensed entries are fine for local
sketches but flag a human decision before any release that chops/pitches them.

| local name | Internet Archive item | content / creator | license |
|---|---|---|---|
| `vx_burroughs` | [`naropa_william_s_burroughs3`](https://archive.org/details/naropa_william_s_burroughs3) | William S. Burroughs reading — Naropa Poetics Audio Archive | **CC BY-NC-ND 1.0** (⚠ ND) |
| `vx_ginsberg` | [`Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002`](https://archive.org/details/Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002) | Allen Ginsberg & Anne Waldman reading, April 1977 — Naropa | **CC BY-NC-ND 1.0** (⚠ ND) |
| `vx_waldman` | [`Anne_Waldman_reading_1978_August_1978_78P110`](https://archive.org/details/Anne_Waldman_reading_1978_August_1978_78P110) | Anne Waldman reading, August 1978 — Naropa | **CC BY-NC-ND 1.0** (⚠ ND) |
| `vx_ginsberg_class` | [`Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020`](https://archive.org/details/Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020) | Allen Ginsberg — "Basic Poetics" class, 20 April 1980 (a full poetics *lecture*) — Naropa Poetics Audio Archive | **CC BY-NC-ND 1.0** (⚠ ND) |
| `vx_conet_poacher` | [`ird059`](https://archive.org/details/ird059) — `tcp_d1_06` | The Conet Project: The Lincolnshire Poacher (MI6 numbers station) — Irdial-Discs | Irdial "Free Music Philosophy" (free to copy; ⚠ no CC grant) |
| `vx_conet_swedish` | [`ird059`](https://archive.org/details/ird059) — `tcp_d1_01` | The Conet Project: The Swedish Rhapsody — Irdial-Discs | Irdial "Free Music Philosophy" (free to copy; ⚠ no CC grant) |
| `vx_blake` | [`songsofinnocenceandexperience_2001_librivox`](https://archive.org/details/songsofinnocenceandexperience_2001_librivox) | Blake, *Songs of Experience* — LibriVox volunteers | public domain |
| `vx_dickinson` | [`dickinson_poems_bm_librivox`](https://archive.org/details/dickinson_poems_bm_librivox) | Dickinson, "Because I could not stop for Death" — LibriVox (Becky Miller) | public domain |
| `vx_whitman` | [`leaves_of_grass_librivox`](https://archive.org/details/leaves_of_grass_librivox) | Whitman, *Song of Myself* pt. 1 — LibriVox volunteers | public domain |
| `vx_xminusone` | [`OTRR_X_Minus_One_Singles`](https://archive.org/details/OTRR_X_Minus_One_Singles) | *X Minus One*, "The Cave of Night" (NBC, 1956) — countdown intro | OTRR collection tagged **CC BY-NC-ND 3.0** (⚠ ND; underlying show OTRR-certified PD) |
| `vx_suspense` | [`OTRR_Suspense_Singles_By_Year_1942`](https://archive.org/details/OTRR_Suspense_Singles_By_Year_1942) | *Suspense*, "The Hitch-Hiker" w/ Orson Welles (CBS, 1942) — opening | OTRR collection tagged **CC BY-NC-ND 4.0** (⚠ ND; underlying show OTRR-certified PD) |
| `vx_fdr` | [`FDRFiresideChatWarOnJapan`](https://archive.org/details/FDRFiresideChatWarOnJapan) | FDR fireside chat, Dec 9 1941 | public domain (PD mark) |
| `vx_dday` | [`Complete_Broadcast_Day_D-Day`](https://archive.org/details/Complete_Broadcast_Day_D-Day) | CBS complete broadcast day, June 6 1944, part 1 — first bulletins | public domain |
| `vx_wwvh` | [`sraa-7ov2e9got5ntfl3y4r9mnblppuzdkm`](https://archive.org/details/sraa-7ov2e9got5ntfl3y4r9mnblppuzdkm) | NIST WWVH time station as heard in the 1980s — Shortwave Radio Audio Archive | **CC BY-NC 3.0** (derivatives OK, non-commercial) |
| `vx_apollo` | [`apollo11_highlights`](https://archive.org/details/apollo11_highlights) | Apollo 11 mission audio highlights (capcom/crew loop) | NASA voice traffic — public domain (item has no license statement) |
| `vx_timelady` | [`AtTheTone01`](https://archive.org/details/AtTheTone01) | "At The Tone" 01 — telephone time-of-day / weather announcement recordings, comp. J Frederick | ⚠ none stated |
| `vx_cn_east` | [`sailing-the-seas-depends-on-the-helmsman-english`](https://archive.org/details/sailing-the-seas-depends-on-the-helmsman-english) | "The East Is Red", massed chorus + orchestra — China Record Corp., 1967 (chinawave) | **CC0** |
| `vx_cn_march` | [`Music_of_the_Chinese_Revolution`](https://archive.org/details/Music_of_the_Chinese_Revolution) | "March of the People's Liberation Army", band (chinawave) | ⚠ none stated (LP rip) |
| `vx_cn_opera` | [`lp_arias-from-the-opera-the-white-haired-g_china-opera-and-dance-drama-theatre`](https://archive.org/details/lp_arias-from-the-opera-the-white-haired-g_china-opera-and-dance-drama-theatre) | "The North Wind Blows" from *The White-Haired Girl* — China Opera and Dance Drama Theatre, 1950s (chinawave) | ⚠ none stated (LP rip) |
| `vx_cn_speech` | [`sraa-radio-peking-1963`](https://archive.org/details/sraa-radio-peking-1963) | Radio Peking shortwave broadcast, 1963 (rec. Ian Holder) — Shortwave Radio Audio Archive (chinawave) | **CC BY-NC 3.0** (derivatives OK, non-commercial) |
| `vx_sv_choir` | [`78_polushko-polie…gbia0060054b`](https://archive.org/details/78_polushko-polie-my-own-my-beloved-field_a-v-alexandrov-peoples-artist-of-the-u_gbia0060054b) | "Polyushko-Polye" — A.V. Alexandrov Red Army Ensemble, 78rpm (sovietwave) | pre-1946 Soviet recording, PD-old; George Blood rip, no license stated |
| `vx_sv_march` | [`78_march-of-the-tanks…gbia0033872b`](https://archive.org/details/78_march-of-the-tanks_chorus-and-orch-gabt-ussr-elen-senkewich-v-timofeiev-m-bl_gbia0033872b) | "March of the Tanks" — chorus & orch. GABT USSR, 1941 78rpm (sovietwave) | pre-1946, PD-old; no license stated |
| `vx_sv_speech` | [`leninspeeches1919-1921`](https://archive.org/details/leninspeeches1919-1921) | V.I. Lenin, speeches recorded on gramophone discs, 1919–1921 (sovietwave) | PD-old (1919–21 recordings) |
| `vx_sv_radio` | [`sraa-radio-moscow-salyut-6-space-station-coverage-december-10-1977`](https://archive.org/details/sraa-radio-moscow-salyut-6-space-station-coverage-december-10-1977) | Radio Moscow English service, Soyuz 26 launch, Dec 10 1977 — Shortwave Radio Audio Archive (sovietwave) | **CC BY-NC 3.0** (derivatives OK, non-commercial) |

## Sampled instruments (found/samples/instruments/ — fetch-found-samples.sh + fetch-guitar-samples.sh, faust/sf2.js + faust/extract-gm.js)

The SAMPLER voice model plays real instrument zones extracted from a SoundFont
at fetch time (SF2 → wav zones + zones.json with root keys and loop points;
the font itself is never committed or shipped).

| local dir | source | content | license |
|---|---|---|---|
| `alto_sax` `tenor_sax` `trumpet` `flute` `clarinet` `vibraphone` `strings` `nylon_string_guitar` `steel_string_guitar` `bandoneon` `acoustic_bass` `percussive_organ` `rock_organ` `trombone` `muted_trumpet` `oboe` `cello` `harp` `celesta` `ahh_choir` `fretless_bass` `harmonica` `church_organ` `honky_tonk` `french_horns` `jazz_guitar` `bright_yamaha_grand` `marimba` | **FluidR3 GM/GS** SoundFont by Frank Wen, via [`fluidr3-gm-gs`](https://archive.org/details/fluidr3-gm-gs) on archive.org | single-note multi-zone keymaps (6 zones each, SF2 loop points preserved) | **MIT** — FluidR3 is distributed under the MIT license (Frank Wen, 2000-2002; license text ships with the canonical FluidR3_GM.zip distributions, e.g. member.keymusician.com/Member/FluidR3_GM/). The archive.org item's CC-BY-ND tag is the uploader's, not the font's grant. |
| **the full General MIDI set** — all 128 bank-0 FluidR3 melodic presets (`faust/extract-gm.js`, 2026-07 "all of GM"): the acoustic families above plus `rhodes_ep` `legend_ep_2` `electric_piano` `yamaha_grand_piano` `violin` `viola` `contrabass` `slow_strings` `tremolo` `timpani` `ohh_voices` `solo_vox` `orchestra_hit` `clean_guitar` `palm_muted_guitar` `overdrive_guitar` `distortion_guitar` `guitar_harmonics` `soprano_sax` `baritone_sax` `english_horn` `bassoon` `piccolo` `recorder` `ocarina` `banjo` `koto` `shamisen` `fiddle` `dulcimer` `music_box` `xylophone` `tubular_bells` `tinker_bell` `picked_bass` `pop_bass` `slap_bass` `reed_organ` `brass_section` `bowed_glass` `space_voice` … | **FluidR3 GM/GS** (same font/item as above) | 105 usable multi-zone keymaps (6 zones each). The 24 single-zone presets (SFX, one-note synth pads, DrawbarOrgan) extract but are one-shot color only. Now the default sound: `state.sampledOnly` on by default, signature synths (tb303 etc.) exempt. | **MIT** (Frank Wen, as above) |
| `felt_piano` | **FluidR3 GM/GS** GM 0 "Yamaha Grand Piano" (same font/item as above) | 10-zone keymap (dense midrange — the neoclassical lead is exposed), made *felt* by baking a 3 kHz lowpass into the zone wavs at extraction (fetch-found-samples.sh; sample counts unchanged, SF2 loop points preserved). A derivative work of the FluidR3 samples, not a new recording. Chosen over external "felt piano" sample sets: no CC0/PD felt piano with verifiable provenance and per-note loop data was found (the well-known felt libraries — e.g. Spitfire LABS Soft Piano — are EULA-restricted, not redistributable). | **MIT** (Frank Wen, as above) |
| `drums/acoustic` `drums/room` `drums/power` `drums/electronic` `drums/jazz` `drums/brush` | **FluidR3 GM/GS** GM **bank 128** percussion (Standard / Room / Power / Electronic / Jazz / Brush kits; same font/item as above) | SAMPLED DRUM KITS — per-hit one-shots (kick/snare/hi-hats/toms + rim/clap/crash/ride), one recorded GM drum note each, at natural pitch (`faust/sf2.js drumkit`). Additive to the Faust synth kicks; genres opt in via `drums.kit` (genre-kernel `DRUMKITS`). Wavs gitignored/derived, `len` mirrored in `DRUMKITS`. | **MIT** (Frank Wen, as above) |
| `crunch_guitar` `di_guitar` | **FreePats "FSBS Electric Guitar"** (roberto@zenvoid.org, version 2022-09-11) — [freepats.zenvoid.org/ElectricGuitar/](https://freepats.zenvoid.org/ElectricGuitar/distorted-electric-guitar.html); SF2 variants fetched by `tools/fetch-guitar-samples.sh`, zones extracted by `faust/extract-gm.js` | a real Fender, bridge pickups: **dist #2** re-amped through an amplifier + effects rack (distorted, 10–33 s natural sustains, trimmed to 8 s + fade at fetch) → `crunch_guitar`; **direct** = the raw DI pickup signal (~-27 dB RMS by design) meant to feed the engine's staged `insert_higain` amp → `di_guitar`. New ids; the polite GM guitar dirs stay. | **CC0 1.0** — `cc0.txt` ships inside every archive; the site states it; `readme.txt` repeats it |
| `tenor_sax` (REPLACEMENT of the FluidR3 extract, same id) | **FreePats Tenor Saxophone** (VCSL samples by Versilian Studios LLC, re-edited with infinite sustain loops by roberto@zenvoid.org, version 2020-07-17) — [freepats.zenvoid.org/Reed/saxophone.html](https://freepats.zenvoid.org/Reed/saxophone.html); fetched by `tools/fetch-guitar-samples.sh` | 8-zone looped tenor-sax keymap (every zone carries a sustain loop — real reed breath that holds under a solo note) | **CC0 1.0** (`readme.txt` in the archive; VCSL itself is CC0) |
| `upright_piano` | **FreePats Upright Piano KW** (a Kawai upright in a living room; recorded by Gonzalo & Roberto, January 2017) — [freepats.zenvoid.org/Piano/acoustic-grand-piano.html#UprightKW](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html#UprightKW); fetched by `tools/fetch-guitar-samples.sh` | 10-zone upright-piano keymap, full 21–108 span, bass-note sustain loops, top octaves natural decay — the intimate/domestic piano voice (NEW id; the GM grand + felt_piano stay) | **CC0 1.0** (`cc0.txt` + `readme.txt` in the archive) |

## Power-chord one-shots (found/samples/hits/pc_* — fetch-guitar-samples.sh)

| local ids | source | content | license |
|---|---|---|---|
| `pc_ds2_open` `pc_ds2_pm` `pc_ds2_pm2` `pc_as2_open` | **Ax_Grinder, "Electric Guitar Power Chords"** — [freesound.org pack 14939](https://freesound.org/people/Ax_Grinder/packs/14939/) (sounds 242799/242800/242801/242802; Jackson Warrior → Line6 POD XT, drop-D). Keyless HQ-preview MP3s (128 kbps — fine for one-shot chugs under a mix; the original WAVs need a freesound API key). | drop-D power chords: open ~10–12.5 s walls (D#2 / A#2 roots, measured) + palm-muted chugs. Registered in genre-kernel `SAMPLES` as `pc_*` (kind:"hit") for the grunge/metal wave to claim. | **CC BY 3.0** — ⚠ **attribution required** in any distributed render/credits: credit *"Ax_Grinder (freesound.org)"* with a link to the pack |

Instrument libraries **rejected on license** during the 2026-07 research pass
(do not fetch, in any form): Unreal Instruments Metal GTX / Standard Guitar
(custom license, no published redistribution grant); lotkey
free-sample-libraries-sfz (no LICENSE file → all rights reserved); Ivy Audio
Piano in 162 (no stated license anywhere on the publisher's site);
Philharmonia samples (their terms prohibit redistribution "as is… as a sampler
instrument" — exactly what this engine does); Shreddage-free / DSK-class /
Spitfire-LABS-class freeware (EULA: free to use, never to redistribute).

## Sample CDs (found/samples/<prefix>/ — tools/fetch-sample-cd.sh)

Break/loop/one-shot crates ingested from archive.org sample-CD items by the
reusable pipeline `tools/fetch-sample-cd.sh` + `tools/classify-sample-cd.py`
(download → mono/trim → classify pitch/bpm/class → register). The audio is
**not committed** (gitignored under `found/samples/`); the fetch recipe, the
per-crate `manifest.json`, and the `genre-kernel.js` `SAMPLES` entries are the
committed, recoverable deliverable. Workflow documented in CLAUDE.md
("Incorporating a sample CD").

| local dir / prefix | source | content | license |
|---|---|---|---|
| `stml/` (`stml_*` ids) | **Fatboy Slim / Norman Cook — "Skip to My Loops"** sample CD, [`fatboy-slim-skip-to-my-loops`](https://archive.org/details/fatboy-slim-skip-to-my-loops) on archive.org (single zip, 79 generically-named WAVs) | funky breakbeat **loops** (bpm recovered by the classifier), plus a handful of vocal/funk **chops** and one-shot **hits**. Big-beat DNA — wired into `bigbeat` (+ breakcore/jungle/boombap/triphop and the invented *break* genres), the *house*/*funk* chops pools, and the bigbeat/house/gabber/electro/miamibass/disco hit pools. | unauthorized rip of an out-of-print commercial sample CD; no license chain (the CD's own user license was of doubtful validity) — tier 3: never redistributed in any form, never in a distributed render |

## MIDI trove (found/midi/ — tools/fetch-midi-trove.sh, 2026-07)

Genre-labeled MIDI rips from the **MIDIMAN Melody Kit 1.0**
([`midiman_melody_kit_1.0_2015-06`](https://archive.org/details/midiman_melody_kit_1.0_2015-06)
on archive.org — ~130k files crawled from ~200 sites in 2015, deduped and
repackaged by Jason Scott, 2022). Used by `tools/mine-midi.js` for **verifier
calibration** (real symbolic distributions vs anchor renders — the first
external check on `genre-verifier.js` targets) and vocabulary/harmony mining.
The MIDI files are **never committed** (gitignored under `found/midi/`) and
never redistributed; what lands in git is the fetch recipe, the miner, and
aggregate statistics (feature distributions, progression/transition tables).
Verbatim musical material is only ever mined from public-domain-composition
sources (pdmusic.org folk, ragtime, classical).

| local dir | rip | content | provenance |
|---|---|---|---|
| `ragtime/` | `Ragtime_rtpress.com_MIDIRip.zip` | ragtime piano (PD compositions) | transcriptions of pre-1926 works; transcriber rights unasserted — statistics + vocabulary |
| `jazz/` | `Jazz_www.thejazzpage.de_MIDIRip.zip` | jazz standards | copyrighted compositions — aggregate statistics only |
| `dub/` | `Dub_MIDIRip.zip` | dub / reggae | copyrighted compositions — aggregate statistics only |
| `folk/` | `AMERICANA_FOLK_www.pdmusic.org_MIDIRip.zip` | American folk/parlor songs (pdmusic.org, PD compositions) | statistics + vocabulary |
| `classical_piano/` | `Classical_Piano_piano-midi.de_MIDIRip.zip` | classical piano (key-detection ground truth) | PD compositions; piano-midi.de rips are CC BY-SA — statistics only |
| `classical_greats/` `classical_guitar/` `classical_violin/` `classical_mfiles/` `classical_midiworld/` | the trove's five other classical rips (~53MB) | classical expansion — the corpus-db melody test bed (solo/chamber lines, strong key signatures) | PD compositions; transcriber rights per-site — statistics only |

The corpus also lives as a **derived SQLite database** (`tools/corpus-db.js` —
note blobs + extracted melody lines + feature vectors) at
`/mnt/sources/relocated/stellate-midi-corpus/corpus.db`, deliberately OFF-repo:
`found/` is rsynced to the droplet by `tools/ship.sh`, so multi-GB derived
artifacts must never land under it. Rebuildable from the rips at any time.

## Repertoire wave 3 — hits + breaks expansion (found/samples/ — tools/fetch-hits-expansion.sh, 2026-07)

The one-shot/break vocabulary expansion that fills the `SOURCE_POOLS` classes
(`vocal_stab` / `chime` / `horn_stab` / `rave_stab` / `perc_hit` + the
bpm-banded `break_*` pools — docs/NEXT.md §5f). Every source license-verified
per item (metadata, not search index) — this wave is deliberately tier-1-only:

| local files / ids | source | content | license |
|---|---|---|---|
| `breaks/dl_*.wav` (`dl_82_10` … `dl_140_07`, 12 breaks) | **drumloops113** — [`drumloops113`](https://archive.org/details/drumloops113) on archive.org: "13 drum loops I made by recording and choping live drumming and by playing with virtual drum machines" (uploader = author) | live/machine funk breaks, 82–140 bpm (bpm measured by `tools/classify-sample-cd.py`, pinned in the fetch script) — the `break_75_95`…`break_135_150` pool bands | **CC BY 2.5** (author-granted; attribute "jeremy@agitprop.ca, drumloops 1-13, archive.org") |
| `hits/chime_*.wav`, `hits/perc_*.wav` (4 chimes + 7 percussion one-shots) | **VCSL — Versilian Community Sample Library** ([github.com/sgossner/VCSL](https://github.com/sgossner/VCSL)) | tubular bells C4/E3, hand chime A4, glockenspiel C6; timpani hit, gong, anvil, woodblock, slapstick, agogo, cowbell — the `chime` + `perc_hit` pools | **CC0-1.0** (repo LICENSE, verified via GitHub license API) |
| `78s/horns_ne_78.wav`, `78s/horns_ll_78.wav` | George Blood 78rpm digitizations: [`78_national-emblem…gbia0426619a`](https://archive.org/details/78_national-emblem_manhattan-military-band-e-e-bagley_gbia0426619a) (1922), [`78_liberty-loan-march…gbia0440191a`](https://archive.org/details/78_liberty-loan-march_paramount-military-band-sousa_gbia0440191a) (1918) | military-band brass tuttis cut at the loudest window — the shellac `horn_stab` pool (with the existing `horns_78`) | published pre-1923 → **US public domain by age** (Music Modernization Act; item `date` metadata verified) |
| `78s/caruso_78.wav`, `78s/laughs_78.wav` | [`78_tosca---e-lucevan-le-stelle…gbia0012566a`](https://archive.org/details/78_tosca---e-lucevan-le-stelle-the-stars-were-shining_enrico-caruso-puccini-victor-o_gbia0012566a) (Caruso, 1909), [`78_some-laughs_gbia0395185a`](https://archive.org/details/78_some-laughs_gbia0395185a) (1920 laughing record) | the Tosca climax + a laughing-record burst as vocal stabs — `vocal_stab` pool spice | published pre-1923 → **US public domain by age** |
| `vox/apollo_d..f.wav` (`vox_d`/`vox_e`/`vox_f`) | [`Apollo11Audio`](https://archive.org/details/Apollo11Audio) (NASA JSC Houston Audio Control Room tapes 11-03302/11-03306/11-03308) | three more capcom one-liners for the `vocal_stab` pool (joins `vox_a..c`) | NASA radio traffic — **public domain** (PD mark on item) |
| `hits/hoover_a.wav` `hoover_b` `stab_organ` `stab_saw` | synthesized in-house (ffmpeg `aevalsrc`, recipe in the fetch script — the `tw_ding`/`timer_ding` precedent) | two hoover/mentasm stabs + an M1-ish organ chord + a sus4 saw chord — the `rave_stab` pool (joins the dcc `rave_a..d`) | pure synthesis, **license-free** |

## DX7 patch bank (faust/dx7-presets.json — committed source, not audio)

113 presets decoded (faust/sysex2params.js) from the eight **Yamaha DX7
factory ROM cartridges** (ROM1A "Master" … ROM4B, 1983), fetched from the
[yamahablackboxes.com](https://yamahablackboxes.com/synth-diy/yamaha-dx7-keyboard/) sysex
mirrors (`patches/dx7/factory/rom{1a..4b}.syx`). These banks have been freely
redistributed by Yamaha-adjacent archives, synth museums, and every DX7
editor project for four decades (Dexed ships them; bwhitman/learnfm's 31k-patch
corpus contains them); Yamaha has never asserted rights over the patch DATA —
PD-adjacent by long convention, noted here rather than claimed as a formal
grant. Curation: all 113 decoded patches render non-silent (scratch audit,
2026-07); SFX novelties (TRAIN, EXPLOSION, LASER GUN…) were not decoded.

## Vendored code (committed source, not audio)

- `vendor/espeak-ng/` — **eSpeak NG** compiled to WebAssembly
  ([github.com/espeak-ng/espeak-ng](https://github.com/espeak-ng/espeak-ng)),
  **GPL-3.0-or-later**. Powers dynamic per-seed speech synthesis in the
  browser. GPL, not LGPL: the app as served with this module is a GPL-3.0
  combined work — see NOTICE. (The 244 canned speech recipes below are
  espeak *output* and stay unrestricted regardless.)
- `faust/vendor/lamejs.min.js` — **lamejs 1.2.1** MP3 encoder
  ([github.com/zhuker/lamejs](https://github.com/zhuker/lamejs), the npm
  `lamejs@1.2.1` single-file minified build, verbatim + a small UMD shim),
  **LGPL-3.0**. Used by the WAV-FIRST v3 mobile output path (faust/mp3-worker.js)
  to encode the continuous `audio/mpeg` append stream; served as unmodified
  source alongside this repo, which satisfies LGPL for a scripting-language use.

## hogcore speech roster (found/samples/speech/hp_*.wav — generated, no external source)

The 24-name hogcore cast (Harry Potter character NAMES, names only — no book
text, no film audio) is **synthesized locally** with `espeak-ng` in the marked
"hogcore speech" section of `fetch-found-samples.sh`. Each character gets a
distinct espeak voice variant (en+f1–f5, en+m1–m7, en+croak for Hagrid/Filch/
Buckbeak, en+whisper for Voldemort) plus per-character pitch/speed/resample so
the roster reads as a cast. Character names as short factual identifiers are
not copyrightable; the audio itself is machine-generated on this machine
(eSpeak NG, GPLv3 — its *output* carries no license restriction).

## 30-genre commission signature crates (materials round, 2026-07)

Phase B of the 30 fictional-genre commission (`genre-specs/MATERIALS.md`). Three
kinds of new material, all recoverable from the committed recipes:

### (a) Synthesized speech — `found/samples/speech/sp_*.wav` (generated, no external source)

~20 of the 30 new genres have SYNTHESIZED SPEECH as their signature: the hold-music
apology, the EULA drone, the DMV window calls, ATC read-backs, the auctioneer chant,
the umpire, the town crier, survey prompts, "cycle complete", the microwave grace,
the pseudo-Slavic anthem, and so on. All are **synthesized locally with `espeak-ng`**
in the marked "30-genre commission speech" block of `fetch-found-samples.sh`, exactly
like the hogcore `hp_*` cast: each genre's lines vary voice/pitch/speed per line
(espeak variants f1–f5, m1–m7, the Swedish `sv` voice for ikeacore product names,
`en-gb-x-rp` for the town crier) so each roster reads as a cast. Institutional PA
voices ride a telephone-band filter (highpass 300 / lowpass 3400). **Every text is
original / parodic writing** — no copyrighted lyrics, no trademarks-as-lyrics (generic
phrasings only: "legally distinct", invented product/place names, generic legalese).
eSpeak NG is GPLv3; its audio *output* carries no license restriction — true
for all 244 canned speech recipes in `fetch-found-samples.sh` (this block, the
hogcore cast, the transitwave PA). Distinct from output: the eSpeak NG *code*
also ships in this repo as a WASM build (`vendor/espeak-ng/`) for dynamic
per-seed speech — GPL-3.0, see NOTICE. ids:
`sp_hold_1..4`, `sp_eula_1..3`, `sp_dmv_1..6`, `sp_floor_1..6`, `sp_survey_1..4`,
`sp_dw_done`, `sp_therm_1..3`, `sp_grace_1..2`, `sp_flatpack_1..5`, `sp_laundry_1..2`,
`sp_cereal_1..3`, `sp_scoville_1..5`, `sp_atc_1..5`, `sp_auction_1..3`, `sp_ump_1..4`,
`sp_crier_1..3`, `sp_zubrovia_1..3`, `sp_luna_1..2`, `sp_floppy_save`, `sp_fax_nocarrier`.

### (b) Synthesized one-shots + beds — ffmpeg lavfi (deterministic, license-free)

Tones and drones generated with `ffmpeg` `aevalsrc`/`anoisesrc` — pure synthesis, no
recording, **no attribution required**. Frequencies are the real specs so they read
authentic. In `found/samples/hits/` (recipe: `fetch-found-samples.sh` "commission
tones"): `dtmf_1..9` (the real DTMF low+high dyads — verified 697/770/852 × 1209/1336/1477 Hz),
`mw_beep` (2.05 kHz square microwave beep), `timer_ding`, `gavel`, `handbell`, `degauss`
(the CRT boinnng), plus the SYNTHESIZED-FOLEY `cam_click` / `allen_key` (⚠ approximations
— no honest PD cam-lock/allen-key recording was found; filtered transients stand in).
In `found/` (recipe: `fetch-found-sound.sh` "commission beds"): `crt_whine` (the real
15.734 kHz NTSC flyback line + mains hum — verified), `fax_tone` (1100 Hz CNG + 2100 Hz
CED held as a pad), `hvac_hum` (brown-noise furnace room tone), and two STYLIZED
approximations flagged as such: `modem_handshake` (a recognizable 56k-handshake *synthesis*
— DTMF dial → 2100 Hz answer → dual carriers → FSK warble + scramble noise — NOT a
transcription of the real V.90 sequence) and `floppy_seek` (gated ~220 Hz buzz bursts
standing in for the 3.5" head-stepper clatter). The two stylized beds may read synthetic;
noted here for a possible future real fetch.

### (c) Archive.org PD/CC bed fetches — `found/*.wav` (recipe: `fetch-found-sound.sh`)

The biological + domestic-appliance beds are real field recordings, boost-normalized
(`loudnorm I=-18`; the volcanic-bubble source was very quiet and is pre-boosted +15 dB,
the spokenword-fix path). **Flag for the human release decision:** `pigeon_coo` and
`dryer_spin` are **ShareAlike** (a distributed remix inherits the SA obligation);
`chickadee` needs attribution (BY). The PD / PD-Mark items are unrestricted.

| local name | Internet Archive item | file | content | license basis | genre |
|---|---|---|---|---|---|
| `whale_song` | [`HumpbackWhalesSongsSoundsVocalizations`](https://archive.org/details/HumpbackWhalesSongsSoundsVocalizations) | `Humpback_whale_song_2.mp3` | humpback whale song (38s continuous) | **public domain** — US National Park Service | whalejazz |
| `hydrophone` | [`20150723134918`](https://archive.org/details/20150723134918) | `bunker_inside_underwater.mp3` | hydrophone in a flooded WWII bunker, Vigsø DK | **CC Public Domain Mark 1.0** | atlantidrone |
| `crickets` | [`aporee_50831_57991`](https://archive.org/details/aporee_50831_57991) | `NuitSODA.mp3` | night cricket chorus, Saint-Ouen-des-Alleux FR (radio aporee) | **CC Public Domain Mark 1.0** | crickettempo |
| `ferment_bubble` | [`aporee_27893_32148`](https://archive.org/details/aporee_27893_32148) | `140810caldera2.mp3` | volcanic mud-pot bubbling, Caldara di Manziana IT (aporee); very quiet, boosted | **CC Public Domain Mark 1.0** | sourdough |
| `pigeon_coo` | [`44PalomaDomsticaMuseoDeCienciasDeBahaBlancaArchivoSonoroPaseoDeAves`](https://archive.org/details/44PalomaDomsticaMuseoDeCienciasDeBahaBlancaArchivoSonoroPaseoDeAves) | `44 - Paloma doméstica … Paseo de Aves.mp3` | domestic/rock pigeon 5-note coo, Museo de Ciencias de Bahía Blanca AR | **CC BY-SA 4.0** (⚠ ShareAlike) | pigeonstep |
| `chickadee` | [`ecolore-hamont-bioacoustic-observation-537`](https://archive.org/details/ecolore-hamont-bioacoustic-observation-537) | `hamont-bioacoustic-observation-537.mp3` | black-capped chickadee fee-bee whistle, Hamilton ON (eColore HAMBIO) | **CC BY 4.0** (⚠ attribution) | chickadeecore |
| `dw_cycle` | [`aporee_14738_46150`](https://archive.org/details/aporee_14738_46150) | `szer.mp3` | dishwasher rinse-pump cycle, Poznań kitchen (radio aporee) | **CC Public Domain Mark 1.0** | dishwasherwave |
| `dryer_spin` | [`aporee_8942_14632`](https://archive.org/details/aporee_8942_14632) | `berlinOhlauerWaschsalonContact111204c.mp3` | contact-mic tumble-dryer spin, Berlin Ohlauer Str. waschsalon (aporee) | **CC BY-SA 3.0** (⚠ ShareAlike) | laundrycore |

## Streaming found-video sources (avant-garde + early 3D/CG) — 2026-07

A **streaming** video layer: 26 archive.org items cued directly over HTTP Range
requests (no local download), 97 short muted transformed windows written to
`found/video/stream-sources-new.json` as `{item,file,in,out,tags,credit,title,
unscreened}` entries. Every window is `unscreened:true` — cued blind from
metadata/descriptions/regular spacing (first & last 5% avoided). Paul's eyes are
the taste gate; report and prune bad windows from the app. Same discipline as the
LaserDisc layer above: brief, silent, transformed, non-commercial excerpts;
point people at the archive.org items, don't redistribute the frames.

**License basis per item** (clean age/gov PD and CC are marked; "none stated,
PD-by-age" = pre-1930 works whose copyright has lapsed but the archive.org
*upload* carries no machine-readable license tag):

| # | Internet Archive item | work | license basis |
|---|---|---|---|
| 1 | [`1921WaltherRuttmannOpusI`](https://archive.org/details/1921WaltherRuttmannOpusI) | Ruttmann, *Opus I* (1921) | PD by age (1921) |
| 2 | [`1930LAZSLOMOHOLYNAGYEINLICHTSPIEL`](https://archive.org/details/1930LAZSLOMOHOLYNAGYEINLICHTSPIEL) | Moholy-Nagy, *Ein Lichtspiel Schwarz-Weiss-Grau* (1930) | PD by age (1930) |
| 3 | [`ghosts_before_breakfast`](https://archive.org/details/ghosts_before_breakfast) | Hans Richter, *Vormittagsspuk* (1928) | PD by age (1928) |
| 4 | [`man-ray-emak-bakia-1927`](https://archive.org/details/man-ray-emak-bakia-1927) | Man Ray, *Emak-Bakia* (1926) | PD by age (1926) |
| 5 | [`prostokat-dynamiczny-the-dynamic-rectangle-jozef-robakowski-720p`](https://archive.org/details/prostokat-dynamiczny-the-dynamic-rectangle-jozef-robakowski-720p) | Robakowski, *The Dynamic Rectangle* (1972) | **CC Public Domain Mark 1.0** |
| 6 | [`poemfield_no_5`](https://archive.org/details/poemfield_no_5) | VanDerBeek & Knowlton, *Poemfield No. 5* (1967) | none stated; Bell Labs BEFLIX art film — **verify** |
| 7 | [`experimentsinmotiongraphics1968`](https://archive.org/details/experimentsinmotiongraphics1968) | John Whitney Sr., *Experiments in Motion Graphics* (1968) | none stated; IBM-sponsored, widely circulated — **verify** |
| 8 | [`carlas-island`](https://archive.org/details/carlas-island) | Nelson Max, *Carla's Island* (1981) | none stated; LLNL-era CG demo — **verify** |
| 9 | [`CranstonCsuri1982DemoReel`](https://archive.org/details/CranstonCsuri1982DemoReel) | Cranston-Csuri Productions demo reel (1982) | none stated; studio demo reel — **verify** |
| 10 | [`DigitalEffects1985DemoReel`](https://archive.org/details/DigitalEffects1985DemoReel) | Digital Effects Inc. demo reel (1985) | none stated; studio demo reel — **verify** |
| 11 | [`MarksMarksDemoReel1981`](https://archive.org/details/MarksMarksDemoReel1981) | Marks & Marks demo reel (1981) | none stated; studio demo reel — **verify** |
| 12 | [`WhenMandrillsRuledTheHeavens`](https://archive.org/details/WhenMandrillsRuledTheHeavens) | *When Mandrills Ruled the Heavens* (1983) | none stated — **verify** |
| 13 | [`the-apteryx-and-the-easter-bunny-1970-first-color-2-d-computer-animation-480p-h-264`](https://archive.org/details/the-apteryx-and-the-easter-bunny-1970-first-color-2-d-computer-animation-480p-h-264) | *The Apteryx and the Easter Bunny* (1970) | none stated — **verify** |
| 14 | [`thetacticaledgepart1`](https://archive.org/details/thetacticaledgepart1) | Evans & Sutherland, *The Tactical Edge* pt.1 (1981) | none stated; corporate demo — **verify** |
| 15 | [`thetactialedgepart2`](https://archive.org/details/thetactialedgepart2) | Evans & Sutherland, *The Tactical Edge* pt.2 (1981) | none stated; corporate demo — **verify** |
| 16 | [`journey_to_the_center_of_a_triangle`](https://archive.org/details/journey_to_the_center_of_a_triangle) | Cornwell, *Journey to the Center of a Triangle* (1977) | none stated; educational math film — **verify** |
| 17 | [`voyager-2-flybys-of-uranus-and-neptune-nasa-animations`](https://archive.org/details/voyager-2-flybys-of-uranus-and-neptune-nasa-animations) | James Blinn / NASA-JPL, Voyager 2 flyby animations (1980s) | NASA/JPL — **public domain** |
| 18 | [`XFR_2013-07-17_05`](https://archive.org/details/XFR_2013-07-17_05) | Dov Jacobson, *Human Vectors* (1982) | none stated; XFR STN / New Museum digitization — **verify** |
| 19 | [`commodore-demo-capture-virtual-dreams-love-1994-119665-aga`](https://archive.org/details/commodore-demo-capture-virtual-dreams-love-1994-119665-aga) | Virtual Dreams, *Love* (Amiga AGA demo, 1994) | none stated; demoscene prod, freely-distributed by convention — **verify** |
| 20 | [`ChelovekskinoapparatomManWithAMovieCamera`](https://archive.org/details/ChelovekskinoapparatomManWithAMovieCamera) | Dziga Vertov, *Man With A Movie Camera* (1929) | **CC Public Domain** (item tag) + PD by age |
| 21 | [`berlin-symphony-of-a-metropolis-1927-by-walter-ruttmann`](https://archive.org/details/berlin-symphony-of-a-metropolis-1927-by-walter-ruttmann) | Ruttmann, *Berlin: Symphony of a Metropolis* (1927) | **CC Public Domain Mark 1.0** + PD by age |
| 22 | [`rienquelesheuresalbertocavalcanti1926`](https://archive.org/details/rienquelesheuresalbertocavalcanti1926) | Cavalcanti, *Rien que les heures* (1926) | PD by age (1926) |
| 23 | [`regen_1929`](https://archive.org/details/regen_1929) | Joris Ivens, *Regen / Rain* (1929) | PD by age (1929) |
| 24 | [`RuttmannWalterMelodieDerWelte`](https://archive.org/details/RuttmannWalterMelodieDerWelte) | Ruttmann, *Melodie der Welt* (1929) | **CC Public Domain Mark 1.0** + PD by age |
| 25 | [`SVS-92`](https://archive.org/details/SVS-92) | NASA/GSFC Scientific Visualization Studio, *The Runner* (1996) | NASA — **public domain** |
| 26 | [`1921VikkingEggelingSymphonieDiagonale`](https://archive.org/details/1921VikkingEggelingSymphonieDiagonale) | Viking Eggeling, *Symphonie Diagonale* (1921) | PD by age (1921) |

Every listed `file` was confirmed to stream: HTTP Range `bytes=0-1` returned
`206 Partial Content` with `Content-Type: video/mp4` (browser-playable h.264 /
MPEG-4 derivative). Filenames contain spaces / non-ASCII and must be
URL-encoded in the `download/<item>/<file>` URL.
