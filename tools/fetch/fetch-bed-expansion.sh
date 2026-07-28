#!/usr/bin/env bash
# fetch-bed-expansion.sh — the bed-pool expansion (repertoire wave 3).
# 79 new found-sound beds across ten character classes (city air / road hum /
# machine room / voices on tape / night air / deep water / room tone + NEW:
# weather / smalltown / shortwave-static). Every item license-verified against
# its archive.org metadata (licenseurl) on 2026-07-10; permissive-only slate:
# CC Public Domain Mark, CC BY, CC BY-SA (SA flagged). No NC, no ND.
# Attribution ledger: SOURCES.md "Bed-pool expansion" section (license accuracy
# is the hard requirement; BY needs credit, BY-SA inherits ShareAlike).
# Same recipe shape as tools/fetch/fetch-found-sound.sh: curl the archive.org file,
# trim a window, mono 44.1k MP3 V2, loudnorm to -18 LUFS. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/../.."      # tools/ -> repo root
OUT="${BED_OUT:-found}"      # override with BED_OUT=<dir> for staging tests
mkdir -p "$OUT"
IA="https://archive.org/download"
getbed() { # url | ss | dur | name
  local out="$OUT/$4.mp3"
  [ -s "$out" ] && return 0
  echo "-> bed $4"
  curl -sL --retry 2 --max-time 300 -o /tmp/bed.$$ "$1"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i /tmp/bed.$$ \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "loudnorm=I=-18:TP=-1.5" "$out"
  rm -f /tmp/bed.$$
}
getbed1() { # url | ss | dur | name — SINGLE-CHANNEL take (anti-phase stereo would
  # cancel under an -ac 1 downmix; verified on kintai_shortwave: downmix -57 dB,
  # channel 0 -18 dB. Use for electromagnetic/coil recordings when downmix nulls.)
  local out="$OUT/$4.mp3"
  [ -s "$out" ] && return 0
  echo "-> bed $4 (ch0)"
  curl -sL --retry 2 --max-time 300 -o /tmp/bed.$$ "$1"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i /tmp/bed.$$ \
    -codec:a libmp3lame -q:a 2 -ar 44100 \
    -af "pan=mono|c0=c0,loudnorm=I=-18:TP=-1.5" "$out"
  rm -f /tmp/bed.$$
}


# ===== CITY AIR =====
# Empress Market Karachi walkthrough — aporee_33725_38795 (CC Public Domain Mark 1.0, 234.8s src)
getbed "$IA/aporee_33725_38795/EmperessMarketEdited.mp3" 30 40 empress_market
# Big bazaar ambience, Xanthi GR — aporee_30735_35347 (CC BY, 154.1s src)
getbed "$IA/aporee_30735_35347/Bigbazaarambience.mp3" 23 40 xanthi_bazaar
# Tunis souk walk — aporee_56148_64205 (CC Public Domain Mark 1.0, 60.8s src)
getbed "$IA/aporee_56148_64205/TunisSoukchant.mp3" 9 40 tunis_souk
# Souk Haddadine metal workers, Marrakesh — aporee_22317_25900 (CC BY, 180.1s src)
getbed "$IA/aporee_22317_25900/marrakeshMedinaBlacksmith140226.mp3" 27 40 marrakesh_forge
# Brighton Pier arcade machines — aporee_27514_31721 (CC Public Domain Mark 1.0, 327.2s src)
getbed "$IA/aporee_27514_31721/BrightonPierarcade.mp3" 30 40 brighton_arcade
# Las Vegas Strip casino floor — aporee_21167_24591 (CC Public Domain Mark 1.0, 114.7s src)
getbed "$IA/aporee_21167_24591/lasvegascasino.mp3" 17 40 vegas_casino
# NYC metro station, Midtown — aporee_21691_25214 (CC Public Domain Mark 1.0, 255.8s src)
getbed "$IA/aporee_21691_25214/032140215173333.mp3" 30 40 nyc_subway
# Last BART train, MacArthur station Oakland — aporee_18542_21525 (CC Public Domain Mark 1.0, 76.3s src)
getbed "$IA/aporee_18542_21525/LastBARTMacArthur.mp3" 11 40 bart_last_train
# Deak Ferenc Ter metro escalator — aporee_34266_39393 (CC Public Domain Mark 1.0, 243.8s src)
getbed "$IA/aporee_34266_39393/DeakFerenczTerescelator.mp3" 30 40 budapest_escalator
# Schoolyard break, Niederkassel DE — aporee_27924_32185 (CC Public Domain Mark 1.0, 86.0s src)
getbed "$IA/aporee_27924_32185/GrundschuleLlsdorf.mp3" 13 40 schoolyard_break
# Playground in the afternoon, Amsterdam — aporee_19823_23031 (CC Public Domain Mark 1.0, 71.1s src)
getbed "$IA/aporee_19823_23031/STE0012KinderspeelplaatsHendrik27092013.mp3" 11 40 playground_amsterdam
# Keelung fish market — aporee_17407_20260 (CC BY, 112.2s src)
getbed "$IA/aporee_17407_20260/Soundmap2012062452.mp3" 17 40 keelung_fishmarket

# ===== ROAD HUM =====
# Night traffic, Beitou Taipei — aporee_20245_23563 (CC Public Domain Mark 1.0, 157.2s src)
getbed "$IA/aporee_20245_23563/SoundMap201311026.mp3" 24 40 beitou_night_traffic
# Morning traffic, Guilderland NY — aporee_14133_16462 (CC Public Domain Mark 1.0, 138.1s src)
getbed "$IA/aporee_14133_16462/guilderlandtraffic.mp3" 21 40 morning_traffic_ny
# Kobri Al Azhar traffic jam, Cairo — aporee_13530_15782 (CC BY, 140.3s src)
getbed "$IA/aporee_13530_15782/alazharstreet.mp3" 21 40 cairo_traffic_jam
# Freight train in a blizzard, Colorado Springs — aporee_30574_35173 (CC BY, 158.3s src)
getbed "$IA/aporee_30574_35173/FreightTrainSnowstorm.mp3" 24 40 blizzard_freight
# Under snow: I-25 pedestrian bridge — aporee_30577_35176 (CC BY, 198.7s src)
getbed "$IA/aporee_30577_35176/I25PedestrianBridgeSnowTREAT.mp3" 30 40 snow_highway
# Tram ride, Foz do Douro Porto — aporee_20129_23437 (CC Public Domain Mark 1.0, 300.1s src)
getbed "$IA/aporee_20129_23437/tramone.mp3" 30 40 porto_tram
# Night activity in train yard, Bratislava — aporee_48325_54967 (CC BY, 270.9s src)
getbed "$IA/aporee_48325_54967/201603242133Ruchaposun.mp3" 30 40 bratislava_trainyard

# ===== MACHINE ROOM =====
# Spinning machinery, Coldharbour Mill — aporee_16852_19600 (CC BY-SA (ShareAlike inherits), 92.1s src)
getbed "$IA/aporee_16852_19600/21042009coldharbourmill01.mp3" 14 40 coldharbour_mill
# Old litho press, Williams Press — aporee_25084_30610 (CC BY-SA (ShareAlike inherits), 158.7s src)
getbed "$IA/aporee_25084_30610/B12h33m27s02oct2014oldprintingpress.mp3" 24 40 litho_press
# Inside the Jonge Schaap windmill sawmill — aporee_54394_62217 (CC Public Domain Mark 1.0, 212.8s src)
getbed "$IA/aporee_54394_62217/zaandampila.mp3" 30 40 zaandam_sawmill
# Turbine at hydro power plant, Uzpaliai LT — aporee_13260_15495 (CC Public Domain Mark 1.0, 149.1s src)
getbed "$IA/aporee_13260_15495/elektrine.mp3" 22 40 hydro_turbine
# Rotating motor of a wind turbine, Bouin FR — aporee_34689_39885 (CC Public Domain Mark 1.0, 134.6s src)
getbed "$IA/aporee_34689_39885/CAPSEoliennemoteurcricket.mp3" 20 40 wind_turbine_motor
# Nastup mine grinding plant, Kadan CZ — aporee_14900_17371 (CC Public Domain Mark 1.0, 75.2s src)
getbed "$IA/aporee_14900_17371/besidegrinder.mp3" 11 40 grinding_plant
# Victorian pumping station, Fobney Lock Reading — aporee_47462_53934 (CC Public Domain Mark 1.0, 741.4s src)
getbed "$IA/aporee_47462_53934/FobneyVictorianpumpingstation.mp3" 30 40 pumping_station
# Ice stadium ice machine, Duesseldorf — aporee_16196_18783 (CC Public Domain Mark 1.0, 302.2s src)
getbed "$IA/aporee_16196_18783/DusseldorfEisstadionEiswagenNeumannb.mp3" 30 40 ice_machine
# Flour mill silo resonances, Maribor — aporee_13729_16009 (CC BY-SA (ShareAlike inherits), 210.1s src)
getbed "$IA/aporee_13729_16009/mariborMehlmuehleSilos290512.mp3" 30 40 silo_resonance

# ===== VOICES ON TAPE =====
# Pulkovo airport announcements, St Petersburg — aporee_52884_60425 (CC Public Domain Mark 1.0, 138.0s src)
getbed "$IA/aporee_52884_60425/610eBIPETERSBURGairportannouncenemtssoundwalking190904003.mp3" 21 40 pulkovo_pa
# Station broadcast messages, Kaohsiung — aporee_18791_21802 (CC Public Domain Mark 1.0, 60.2s src)
getbed "$IA/aporee_18791_21802/SoundMap2012032942.mp3" 9 40 kaohsiung_pa
# Leeds United final match of the season — aporee_31056_35699 (CC Public Domain Mark 1.0, 206.9s src)
getbed "$IA/aporee_31056_35699/LeedsUnitedGameSR004BinauraleditedConverted.mp3" 30 40 leeds_terrace
# Bloemfontein Celtic fans singing — aporee_7691_9439 (CC BY-SA (ShareAlike inherits), 210.1s src)
getbed "$IA/aporee_7691_9439/BloemfonteinCelticSupportersOct2009.mp3" 30 40 celtic_fans
# Song in the Alexander Nevsky Monastery — aporee_30388_34974 (CC BY-SA (ShareAlike inherits), 114.8s src)
getbed "$IA/aporee_30388_34974/LordhavemercyAlexanderNevskyMonastery.mp3" 17 40 nevsky_choir
# Ferry to Oslo, announcement on board — aporee_14593_16997 (CC Public Domain Mark 1.0, 79.1s src)
getbed "$IA/aporee_14593_16997/FahrenachOsloAnkunftAnsage.mp3" 12 40 oslo_ferry_pa

# ===== NIGHT AIR =====
# Coyote howling at night, Tall Grass Prairie OK — aporee_38611_44124 (CC Public Domain Mark 1.0, 181.1s src)
getbed "$IA/aporee_38611_44124/215141felixblumeacoyoteishowlingduringthenightinthetallgrassprairieoklahomausa.mp3" 27 40 coyote_prairie
# Cricket singing at night, Tepoztlan MX — aporee_43806_49863 (CC Public Domain Mark 1.0, 287.6s src)
getbed "$IA/aporee_43806_49863/GrilloTEP130102T05RxNoise.mp3" 30 40 tepoztlan_cricket
# Owls and insects, Millville NJ — aporee_28200_32491 (CC Public Domain Mark 1.0, 543.0s src)
getbed "$IA/aporee_28200_32491/06Track6.mp3" 30 40 nj_owls
# Cicada nighttime, Mugla TR — aporee_37508_42950 (CC Public Domain Mark 1.0, 117.0s src)
getbed "$IA/aporee_37508_42950/07312306391trim.mp3" 18 40 mugla_cicadas
# Dawn chorus with fox barks + nightingale, Berlin — aporee_48991_55788 (CC Public Domain Mark 1.0, 595.4s src)
getbed "$IA/aporee_48991_55788/DawnchorusFriedhofColumbiadammedit.mp3" 30 40 berlin_dawn_fox
# Dawn chorus, Tsendze Kruger Park — aporee_33795_38875 (CC Public Domain Mark 1.0, 758.7s src)
getbed "$IA/aporee_33795_38875/TsendzeRusticCampsite.mp3" 30 40 kruger_dawn
# Curlew, grey heron and fir trees at night, Mull — aporee_47362_53818 (CC Public Domain Mark 1.0, 463.0s src)
getbed "$IA/aporee_47362_53818/NightCurlewandHeronwithfirtrees.mp3" 30 40 mull_night
# Ibis evening, Wauchula FL — aporee_19043_22382 (CC Public Domain Mark 1.0, 34.7s src)
getbed "$IA/aporee_19043_22382/IbisEvening.mp3" 2 31 ibis_evening

# ===== DEEP WATER =====
# Swamp underwater hydrophone, Utena LT — aporee_19431_22572 (CC Public Domain Mark 1.0, 161.6s src)
getbed "$IA/aporee_19431_22572/hidrofonasaporee1.mp3" 24 40 swamp_underwater
# Underwater mechanica, Utena LT — aporee_23818_27676 (CC Public Domain Mark 1.0, 298.0s src)
getbed "$IA/aporee_23818_27676/underwatermechanika.mp3" 30 40 underwater_mechanica
# Middle Mill weir underwater, Colchester — aporee_30821_35445 (CC Public Domain Mark 1.0, 288.0s src)
getbed "$IA/aporee_30821_35445/hydropwier.mp3" 30 40 weir_underwater
# Hydrophone: glacier melt water, Svalbard — aporee_64980_75062 (CC Public Domain Mark 1.0, 96.4s src)
getbed "$IA/aporee_64980_75062/2407100485frammAporee.mp3" 14 40 glacier_melt
# Ocean surf on pebble beach, Corfu — aporee_13421_15669 (CC BY, 455.7s src)
getbed "$IA/aporee_13421_15669/11100803edit.mp3" 30 40 pebble_surf
# Glassy winter surf, Silver Strand CA — aporee_15707_18266 (CC Public Domain Mark 1.0, 91.2s src)
getbed "$IA/aporee_15707_18266/StrandNov2712.mp3" 14 40 winter_surf
# Nocturnal beach, Scheveningen after dark — aporee_22007_25563 (CC Public Domain Mark 1.0, 288.2s src)
getbed "$IA/aporee_22007_25563/NocturnalBeachScheveningen.mp3" 30 40 night_beach
# Sea lions and marine traffic, Petersburg AK — aporee_69662_81117 (CC Public Domain Mark 1.0, 128.4s src)
getbed "$IA/aporee_69662_81117/sealionsboatsnarrows914.mp3" 19 40 sealion_traffic

# ===== ROOM TONE =====
# Office minutes before opening hours, Poznan — aporee_16161_22114 (CC Public Domain Mark 1.0, 180.1s src)
getbed "$IA/aporee_16161_22114/officee.mp3" 27 40 office_predawn
# Kitchen refrigerator, Poznan — aporee_13335_15645 (CC Public Domain Mark 1.0, 120.7s src)
getbed "$IA/aporee_13335_15645/lodowa.mp3" 18 40 kitchen_fridge
# Old domestic oil boiler, Suffolk — aporee_56425_64543 (CC Public Domain Mark 1.0, 537.0s src)
getbed "$IA/aporee_56425_64543/domesticoilboiler.mp3" 30 40 oil_boiler
# Boiler room, MAAT Lisbon — aporee_64588_74537 (CC Public Domain Mark 1.0, 200.0s src)
getbed "$IA/aporee_64588_74537/1167aBILISBOAMAATelectrictyboilerroom2404201735.mp3" 30 40 maat_boiler
# Svalbard Global Seed Vault utility tunnel — aporee_9378_11274 (CC BY-SA (ShareAlike inherits), 177.2s src)
getbed "$IA/aporee_9378_11274/seedvaultalarmbeepventfan.mp3" 27 40 seedvault_tunnel
# Platform 8 ventilation drone, Bremen Hbf — aporee_32401_37255 (CC BY-SA (ShareAlike inherits), 180.1s src)
getbed "$IA/aporee_32401_37255/bremenHbfGleis8Ventilation160605.mp3" 27 40 platform_vent
# Elevator in Mills Music Hall, Oakland — aporee_41528_47359 (CC Public Domain Mark 1.0, 199.2s src)
getbed "$IA/aporee_41528_47359/oaklandMillsMusicDepartmentElevator10162018.mp3" 30 40 mills_elevator

# ===== WEATHER =====
# Rain and thunder, Krabi TH — aporee_41798_47650 (CC Public Domain Mark 1.0, 2100.6s src)
getbed "$IA/aporee_41798_47650/RainandthunderinThailandTH181001T01.mp3" 30 40 krabi_thunder
# Thunderstorm, Campo do Geres PT — aporee_41611_47443 (CC Public Domain Mark 1.0, 240.0s src)
getbed "$IA/aporee_41611_47443/THUNDERSTORM.mp3" 30 40 geres_thunder
# Heavy rain with distant thunderstorm, Ridgewood Queens — aporee_46275_52573 (CC BY, 304.4s src)
getbed "$IA/aporee_46275_52573/RainandDistantThunderstorm.mp3" 30 40 queens_thunder
# Thunderstorm approaching the city, Istanbul — aporee_8182_9955 (CC BY-SA (ShareAlike inherits), 314.5s src)
getbed "$IA/aporee_8182_9955/nahendesgewitter.mp3" 30 40 istanbul_storm
# Rain, Kielce PL — aporee_19222_22313 (CC Public Domain Mark 1.0, 183.3s src)
getbed "$IA/aporee_19222_22313/STE00255.mp3" 27 40 kielce_rain
# Blizzard winds, Ridgewood Queens — aporee_55553_63498 (CC BY, 1509.3s src)
getbed "$IA/aporee_55553_63498/BlizzardNightRidgewoodQueens.mp3" 30 40 queens_blizzard
# Storm heard from inside the house, Shetland — aporee_58995_67701 (CC BY-SA (ShareAlike inherits), 495.9s src)
getbed "$IA/aporee_58995_67701/CarolineSimpsonsHousestorm1.mp3" 30 40 shetland_storm
# Storm at San Isidro lighthouse, Magallanes CL — aporee_43160_49192 (CC Public Domain Mark 1.0, 119.4s src)
getbed "$IA/aporee_43160_49192/160319sanisidrolighthouse.mp3" 18 40 lighthouse_storm
# Le chant du vent, Grenoble — aporee_30729_35341 (CC Public Domain Mark 1.0, 213.8s src)
getbed "$IA/aporee_30729_35341/ventARLEQUIN.mp3" 30 40 grenoble_wind

# ===== SMALLTOWN =====
# Cordes-sur-Ciel village square, Tarn FR — aporee_68104_78862 (CC Public Domain Mark 1.0, 270.0s src)
getbed "$IA/aporee_68104_78862/Cordessurcielpigeonglise.mp3" 30 40 cordes_bells
# Brugge bells — aporee_31799_36524 (CC BY, 320.0s src)
getbed "$IA/aporee_31799_36524/bruggeolv.mp3" 30 40 brugge_bells
# Bells of St. Josef, Solingen-Ohligs — aporee_27760_31992 (CC Public Domain Mark 1.0, 254.8s src)
getbed "$IA/aporee_27760_31992/20150421StJosefinOhligs.mp3" 30 40 stjosef_bells
# Sunday church bell, Janeiro de Baixo PT — aporee_26388_30478 (CC Public Domain Mark 1.0, 99.8s src)
getbed "$IA/aporee_26388_30478/ChurchBellsJaneiroDeBaixo.mp3" 15 40 sunday_bell
# Noon bells heard in the Calgary Tower stairwell — aporee_30896_35526 (CC Public Domain Mark 1.0, 534.9s src)
getbed "$IA/aporee_30896_35526/NoonBellsintheStairway.mp3" 30 40 calgary_noon
# Brocante bells, Bourgueil market FR — aporee_24286_28194 (CC Public Domain Mark 1.0, 175.2s src)
getbed "$IA/aporee_24286_28194/Bourgueilbrocantebells.mp3" 26 40 brocante_bells
# Small town market, Tongluo Township TW — aporee_35408_40667 (CC BY, 116.1s src)
getbed "$IA/aporee_35408_40667/soundmap201702169.mp3" 17 40 tongluo_market
# Xmas storm with bells, Taranto IT — aporee_21030_24432 (CC Public Domain Mark 1.0, 125.8s src)
getbed "$IA/aporee_21030_24432/TramontoneWindRainBellsedit.mp3" 19 40 taranto_storm_bells

# ===== SHORTWAVE =====
# Shortwave listening, Kintai LT — aporee_57712_66065 (CC Public Domain Mark 1.0, 138.7s src)
getbed1 "$IA/aporee_57712_66065/swinKintai.mp3" 21 40 kintai_shortwave   # anti-phase stereo: MUST be single-channel
# Wendover shortwave reception — aporee_6463_8010 (CC BY-SA (ShareAlike inherits), 116.1s src)
getbed "$IA/aporee_6463_8010/17shortwavewendoverUT.mp3" 17 40 wendover_shortwave
# Under railway bridge VLF, St Petersburg — aporee_62035_71384 (CC BY-SA (ShareAlike inherits), 110.1s src)
getbed "$IA/aporee_62035_71384/UnderBR1railway20231108114318.mp3" 17 40 bridge_vlf
# Power station electromagnetics, Antaliepte LT — aporee_39991_45685 (CC Public Domain Mark 1.0, 193.0s src)
getbed "$IA/aporee_39991_45685/antaliepteshespriezor2.mp3" 29 40 power_em
# Radio interference on the harbour, Sydney — aporee_28537_32885 (CC BY-SA (ShareAlike inherits), 61.8s src)
getbed "$IA/aporee_28537_32885/RadioInterferenceBallsHead.mp3" 9 40 harbour_interference

echo "Bed expansion fetched into $OUT/ — $(ls "$OUT"/*.mp3 2>/dev/null | wc -l) beds on disk."
