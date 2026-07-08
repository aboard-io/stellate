#!/usr/bin/env bash
# Fetch + clip the found-VIDEO layer from Internet Archive laserdisc rips.
# Like fetch-found-sound.sh: the clips are NOT committed (gitignored); this
# script IS committed — the recipe that makes the visuals recoverable.
#
#   ./fetch-found-video.sh
#
# SINCE 2026-07 THIS IS A CACHE / FALLBACK BUILDER, NOT A REQUIREMENT. The live
# video layer (video-layer.js) now STREAMS these clips straight from archive.org
# (cue windows in found/video/stream-catalog.json — the committed source), so the
# site runs with an empty found/video/. Running this script pre-bakes the same
# clips locally; the layer uses them as a fast local cache and as the slow-network
# / archive-blocked FALLBACK tier. (render-sample-video.js / journey --video still
# want the local files — the offline renderers don't stream.)
#
# Each clip is cut remotely (ffmpeg range-seeks over HTTP, so only the needed
# bytes are fetched — the source discs are 150MB–1.2GB), scaled to 640px,
# stripped of audio, and re-encoded small. Timestamps were hand-curated by
# sampling frames across each disc (2026-06). The same item/in/out coordinates
# live in found/video/stream-catalog.json for the streaming path. See SOURCES.md.
# Requires: ffmpeg with https support.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p found/video

IA="https://archive.org/download"
VD1="$IA/video-drug-1-deep-laser-disc-1990/Video Drug 1 - Deep (LaserDisc, 1990).mp4"
VD2="$IA/video-drug-2-phuture-laser-disc-1990/Video Drug 2 - Phuture (LaserDisc, 1990).mp4"
PIO="$IA/pioneer-laser-optics-ii-laserdisc/Pioneer Laser Optics II [Laserdisc].mp4"
LV="$IA/laser-vision-demonstration-1986/LaserVision Demonstration (1986).mp4"
SP="$IA/ss098-0001/SS098-0001 SpaceDisc Vol. 1 Space Shuttle Mission Reports STS 5,6 & 7 (Side 1, English) (ld-decode, QTGMC, TV→PC).mp4"
TK="$IA/tokyo-night-drive-4-k-2016/Tokyo night drive 4K 2016 首都高.mp4"
SF="$IA/from-SF/from-SF.mp4"
LW="$IA/TheLostWorld1925/TheLostWorld1925_512.mp4"   # Willis O'Brien stop-motion dinosaurs (1925, PD)
CA="$IA/youtube-hxiZR3Hp_4o/hxiZR3Hp_4o.mp4"         # random CTV/CBC/Global/ATV ads, Nova Scotia, August 1997 — canawave
DC="$IA/discovering-canada-1992-vhs/DiscoveringCanada(1992)VHS.mp4"   # Discovering Canada (1992) travelogue — canawave imagery
# transitwave — NYC subway + railfan footage (1959-1970, PD / home-movie)
SUB="$IA/201359_Subways/201359_Subways_master.intros.mp4"                                    # The Wreck of the NY Subways (Newsreel, 1970) — NYC subway
LCC="$IA/0845_Last_Clear_Chance_The_08_29_26_00/0845_Last_Clear_Chance_The_08_29_26_00.mp4"  # Last Clear Chance (1959, Prelinger) — railroad, speeding trains
IHR="$IA/HMIronHorseRamble98234/98234.mp4"                                                   # Iron Horse Ramble, Reading RR (home movie, 1960) — steam train
DBN="$IA/098243/098243.mp4"                                                                  # PA rail fan: Dearborn station (home movie, 1960-61) — platforms
# transitwave MONTAGE pool — modern, cheerful, colour train/metro footage (a new clip fades in each measure)
NLC="$IA/youtube-AWmqIIOWMiM/AWmqIIOWMiM.mp4"                                                 # Dutch train driver's view (2024, colour cab ride)
CHC="$IA/youtube-4DcMcAHrURw/4DcMcAHrURw.mp4"                                                 # Switzerland 4K cab ride (2022)
RKC="$IA/title-02_202409/TITLE02.ia.mp4"                                                      # Cab Ride Through the Rockies (colour, scenic)
SKC="$IA/Flickr-26122520180/Shinkansen_Ride_Past_Mt._Fuji-26122520180.mp4"                   # Shinkansen bullet train past Mt. Fuji (2016)
LAM="$IA/RyanIsHungry-LAMetroFastCheapCleanAndGreen260-2/RyanIsHungry-LAMetroFastCheapCleanAndGreen260.mp4"  # LA Metro (colour)
NYM="$IA/dyckmanSummer/dykmansummer2018.ia.mp4"                                               # NYC subway: Dyckman St 1 train platform (2018)
# genre-variety pool (curated 2026-07) — Prelinger ephemeral films (PD), city
# symphonies, PD abstract animation, NASA Apollo, soundies, undersea + Hawaii.
# Licenses checked per item 2026-07: Prelinger = CC-PD mark / PD ephemeral;
# pre-1930 films PD by age; NASA = PD-gov. URLs verified (200, ffmpeg-seekable).
ISB="$IA/0736_In_the_Suburbs_01_00_57_00/0736_In_the_Suburbs_01_00_57_00.mp4"                 # In the Suburbs (1957, Prelinger)
DD="$IA/Designfo1956/Designfo1956.mp4"                                                        # Design for Dreaming (1956, Prelinger) — GM Motorama
AL="$IA/American1958/American1958.mp4"                                                        # American Look (1958, Prelinger) — mid-century design
MH2="$IA/MasterHa1936_2/MasterHa1936_2.mp4"                                                   # Master Hands Pt. II (1936, Prelinger) — Chevrolet foundry
NH="$IA/ToNewHor1940/ToNewHor1940.mp4"                                                        # To New Horizons (1940, Prelinger) — GM Futurama
C21="$IA/Century21964/Century21964.mp4"                                                       # Century 21 Calling (1962 Seattle fair, Prelinger)
TF="$IA/0505_To_the_Fair_10_31_38_16/0505_To_the_Fair_10_31_38_16.mp4"                        # To the Fair! (1964 NY World's Fair, Prelinger 2K scan)
SMK="$IA/0388_Supermarket_The_20_31_00_00/0388_Supermarket_The_20_31_00_00_3mb.mp4"           # The Supermarket (ca. 1958, Prelinger)
SG="$IA/OnGuard1956/OnGuard1956.mp4"                                                          # On Guard! The Story of SAGE (1956, Prelinger)
CH="$IA/CoffeeHo1969/CoffeeHo1969.mp4"                                                        # Coffee House Rendezvous (1969, Prelinger)
MN="$IA/silent-manhatta/Manhatta.mp4"                                                         # Manhatta (1921, PD) — first city symphony
MS="$IA/sanfran_hd_h264/sanfran_1080p_stabilized.mp4"                                         # A Trip Down Market Street (1906, CC0 stabilized scan)
SDG="$IA/silent-symphonie-diagonale-aka-symphonie-diaganale/Symphonie%20diagonale%20AKA%20Symphonie%20diaganale.mp4"  # Symphonie Diagonale (1924, PD)
BM="$IA/BalletMcanique/Ballet%20m%C3%A9canique.mp4"                                           # Ballet Mécanique (1924, PD)
FAN="$IA/fantasmagorie_1908/Fantasmagorie_%281908%29.mp4"                                     # Fantasmagorie (1908, PD) — first drawn animation
AP="$IA/APOLLO_16MM_ONBOARD_SELECT_VIEWS/ApolloNTSC.mp4"                                      # Apollo 16mm onboard film (NASA, PD)
HAW="$IA/97351_hm_hawaii/97351.mp4"                                                           # Home Movie 97351: Hawaii (1971, Prelinger home movies)
FFL="$IA/200633_The_Fight_For_Life/200633_The_Fight_for_Life_master.intros.mp4"               # The Fight for Life: Survival Under the Sea (1930, Prelinger)
LMS="$IA/LampOfMemory/LampOfMemory.mp4"                                                       # Lamp of Memory soundie (1944, Prelinger)
GDN="$IA/Amateur_Film_Girls_Dancing/6034_Amateur_Film_Girls_Dancing_01_00_56_25_3mb.mp4"      # Girls Dancing amateur film (1960, Prelinger)

# name|url|start(s)|dur(s)|credit
clips() { cat <<'EOF'
disc_sunset|LV|1492|34|LaserVision Demonstration (1986) — the disc as a setting sun
bamboo|LV|1192|32|LaserVision Demonstration (1986) — bamboo forest
blue_dinner|LV|792|30|LaserVision Demonstration (1986) — blue studio dinner
sun_riders|PIO|82|30|Pioneer Laser Optics II (1989) — riders across a giant sun
sharpest_city|PIO|292|28|Pioneer Laser Optics II (1989) — chrome type over the skyline
cgi_bird|PIO|892|30|Pioneer Laser Optics II (1989) — Symbolics CGI
kaleido|VD2|112|34|Video Drug 2: Phuture (1990) — analog kaleidoscope
phuture_red|VD2|412|30|Video Drug 2: Phuture (1990) — red lattice feedback
rainbow_rings|VD2|1132|30|Video Drug 2: Phuture (1990) — rainbow rings
green_nebula|VD2|1492|32|Video Drug 2: Phuture (1990) — green nebula
deep_face|VD1|592|28|Video Drug 1: Deep (1990) — monochrome face collage
earth_orbit|SP|992|34|NASA SpaceDisc Vol. 1 (1984) — Earth from the shuttle
spacewalk|SP|1692|32|NASA SpaceDisc Vol. 1 (1984) — STS spacewalk
night_lines|VD2|894|34|Video Drug 2: Phuture (1990) — blue electric tracery on black
night_lights|VD2|1294|34|Video Drug 2: Phuture (1990) — night-light kaleidoscope
dark_face|VD1|444|32|Video Drug 1: Deep (1990) — static-glitch face
tv_room|VD1|194|32|Video Drug 1: Deep (1990) — TV set in a dark red room
drive_bluehour|TK|115|34|Tokyo Night Drive (2016, PD) — blue-hour expressway
drive_dusk|TK|695|32|Tokyo Night Drive (2016, PD) — dusk highway
drive_bridge|TK|1290|36|Tokyo Night Drive (2016, PD) — Rainbow Bridge
drive_taillights|SF|50|30|Night drive from SF (PD) — taillights at an intersection
lw_plateau|LW|3460|30|The Lost World (1925, PD) — the lost plateau
lw_graze|LW|3898|16|The Lost World (1925, PD) — a dinosaur grazing
lw_herd|LW|4170|30|The Lost World (1925, PD) — dinosaur herd in the mist
lw_valley|LW|4255|26|The Lost World (1925, PD) — dinosaurs in the valley
lw_london|LW|5225|40|The Lost World (1925, PD) — Brontosaurus loose in London
lw_rampage|LW|5278|22|The Lost World (1925, PD) — Brontosaurus on the streets
ca_canada|CA|252|26|CTV/CBC ads 1997 — "Now available in Canada"
ca_kids|CA|82|26|CTV/CBC ads 1997 — kids at play
ca_cereal|CA|421|26|CTV/CBC ads 1997 — "which side are you on?"
ca_tide|CA|589|26|CTV/CBC ads 1997 — Ultra Tide
ca_chrysler|CA|1139|26|CTV/CBC ads 1997 — Chrysler Marathon II sales event
ca_bumper|CA|1342|26|CTV/CBC ads 1997 — channel bumper
ca_street|CA|1592|26|CTV/CBC ads 1997 — city street
dc_vancouver|DC|3188|26|Discovering Canada (1992) — Vancouver, city and mountains
dc_alberta|DC|2585|26|Discovering Canada (1992) — the prairies
dc_rockies|DC|4185|26|Discovering Canada (1992) — snowy mountains
dc_village|DC|594|26|Discovering Canada (1992) — Nova Scotia fishing village
dc_skyline|DC|1994|26|Discovering Canada (1992) — downtown skyline
tw_platform|DBN|120|26|PA rail fan home movie (1960) — Dearborn station platform
tw_interchange|DBN|300|26|PA rail fan home movie (1960) — station concourse
tw_board|SUB|200|24|The Wreck of the NY Subways (1970) — subway platform
tw_subway|SUB|400|26|The Wreck of the NY Subways (1970) — subway train
tw_terminus|SUB|660|24|The Wreck of the NY Subways (1970) — subway terminal
tw_window|IHR|250|26|Iron Horse Ramble, Reading RR (1960) — from the train
tw_express|LCC|300|26|Last Clear Chance (1959) — express train speeding
tw_rails|LCC|900|24|Last Clear Chance (1959) — the rails
tw_nl1|NLC|140|5|Dutch train driver's view (2024)
tw_nl2|NLC|520|5|Dutch train driver's view (2024)
tw_nl3|NLC|960|5|Dutch train driver's view (2024)
tw_nl4|NLC|1480|5|Dutch train driver's view (2024)
tw_nl5|NLC|1980|5|Dutch train driver's view (2024)
tw_nl6|NLC|2420|5|Dutch train driver's view (2024)
tw_ch1|CHC|360|5|Switzerland 4K cab ride (2022)
tw_ch2|CHC|1100|5|Switzerland 4K cab ride (2022)
tw_ch3|CHC|2000|5|Switzerland 4K cab ride (2022)
tw_ch4|CHC|3000|5|Switzerland 4K cab ride (2022)
tw_ch5|CHC|4000|5|Switzerland 4K cab ride (2022)
tw_ch6|CHC|5000|5|Switzerland 4K cab ride (2022)
tw_ch7|CHC|5800|5|Switzerland 4K cab ride (2022)
tw_rk1|RKC|500|5|Cab Ride Through the Rockies
tw_rk2|RKC|1400|5|Cab Ride Through the Rockies
tw_rk3|RKC|2400|5|Cab Ride Through the Rockies
tw_rk4|RKC|3400|5|Cab Ride Through the Rockies
tw_rk5|RKC|4400|5|Cab Ride Through the Rockies
tw_rk6|RKC|5400|5|Cab Ride Through the Rockies
tw_rk7|RKC|6200|5|Cab Ride Through the Rockies
tw_la1|LAM|22|5|LA Metro (colour)
tw_la2|LAM|60|5|LA Metro (colour)
tw_la3|LAM|98|5|LA Metro (colour)
tw_ny1|NYM|28|5|NYC subway: Dyckman St 1 train (2018)
tw_ny2|NYM|72|5|NYC subway: Dyckman St 1 train (2018)
tw_ny3|NYM|115|5|NYC subway: Dyckman St 1 train (2018)
tw_sk1|SKC|2|5|Shinkansen past Mt. Fuji (2016)
tw_sk2|SKC|9|5|Shinkansen past Mt. Fuji (2016)
tw_jnl1|NLC|180|13|Dutch cab ride — journey, early
tw_jnl2|NLC|1100|13|Dutch cab ride — journey, middle
tw_jnl3|NLC|2100|13|Dutch cab ride — journey, later
tw_jch1|CHC|400|13|Swiss 4K cab ride — journey, early
tw_jch2|CHC|2600|13|Swiss 4K cab ride — journey, middle
tw_jch3|CHC|4800|13|Swiss 4K cab ride — journey, later
tw_jrk1|RKC|500|13|Rockies cab ride — journey, early
tw_jrk2|RKC|3000|13|Rockies cab ride — journey, middle
tw_jrk3|RKC|5500|13|Rockies cab ride — journey, later
tw_jny1|NYM|18|13|NYC subway — journey, early
tw_jny2|NYM|78|13|NYC subway — journey, later
tw_jla1|LAM|14|13|LA Metro — journey, early
tw_jla2|LAM|68|13|LA Metro — journey, later
pl_motorama|DD|128|34|Design for Dreaming (1956, Prelinger) — dancers at the GM Motorama
pl_dreamcar|DD|378|32|Design for Dreaming (1956, Prelinger) — bronze dream car on the turntable
pl_kitchen|AL|330|35|American Look (1958, Prelinger) — the dream kitchen
pl_americana|AL|108|36|American Look (1958, Prelinger) — mid-century modern living
pl_lawns|ISB|458|32|In the Suburbs (1957, Prelinger) — station wagons and front lawns
pl_supermarket|SMK|230|34|The Supermarket (ca. 1958, Prelinger) — a cart down the aisles
pl_parkinglot|SMK|52|32|The Supermarket (ca. 1958, Prelinger) — parking lot of tailfins
pl_futurama|NH|745|40|To New Horizons (1940, Prelinger) — GM Futurama highways of 1960
pl_modelcity|NH|1155|40|To New Horizons (1940, Prelinger) — the model metropolis
pl_spacefair|C21|72|34|Century 21 Calling (1962, Prelinger) — Seattle World's Fair grounds
pl_worldsfair|TF|1098|34|To the Fair! (1964, Prelinger) — crowds at the New York World's Fair
pl_sage|SG|283|35|On Guard! The Story of SAGE (1956, Prelinger) — radar consoles in the dark
bt_hootenanny|CH|315|33|Coffee House Rendezvous (1969, Prelinger) — hootenanny stage
bt_folksinger|CH|550|36|Coffee House Rendezvous (1969, Prelinger) — folk guitarist in the spotlight
cs_manhatta|MN|48|36|Manhatta (1921, PD) — lower Manhattan skyline and harbor
cs_liner|MN|408|34|Manhatta (1921, PD) — ocean liner and tugboats
cs_marketstreet|MS|240|38|A Trip Down Market Street (1906, PD) — trolley ride up Market Street
ind_furnace|MH2|16|34|Master Hands Pt. II (1936, Prelinger) — the foundry furnace
ind_molten|MH2|60|34|Master Hands Pt. II (1936, Prelinger) — molten metal pours
ab_diagonale|SDG|168|36|Symphonie Diagonale (1924, Viking Eggeling, PD) — abstract animation
ab_balletmec|BM|158|36|Ballet Mécanique (1924, Léger/Murphy, PD) — machine rhythm
ab_fantasma|FAN|14|34|Fantasmagorie (1908, Émile Cohl, PD) — the first drawn animation
sp_eva|AP|146|36|Apollo 16mm onboard film (NASA, 1969) — EVA in the open hatch
sp_lander|AP|243|34|Apollo 16mm onboard film (NASA, 1969) — lunar module over the Moon
ns_waterfall|HAW|310|34|Home movie: Hawaii (1971, Prelinger) — waterfall in the green
ns_hula|HAW|226|32|Home movie: Hawaii (1971, Prelinger) — hula dancers with leis
ns_rays|FFL|505|32|The Fight for Life (1930, Prelinger) — rays gliding over the seafloor
ns_octopus|FFL|628|32|The Fight for Life (1930, Prelinger) — octopus ink cloud
dn_soundie|LMS|84|36|Lamp of Memory soundie (1944, Prelinger) — ballroom twirl
dn_schoolyard|GDN|198|36|Girls Dancing (1960, Prelinger) — schoolyard dance in Kodachrome
EOF
}

resolve() { case "$1" in VD1) echo "$VD1";; VD2) echo "$VD2";; PIO) echo "$PIO";; LV) echo "$LV";; SP) echo "$SP";; TK) echo "$TK";; SF) echo "$SF";; LW) echo "$LW";; CA) echo "$CA";; DC) echo "$DC";; SUB) echo "$SUB";; LCC) echo "$LCC";; IHR) echo "$IHR";; DBN) echo "$DBN";; NLC) echo "$NLC";; CHC) echo "$CHC";; RKC) echo "$RKC";; SKC) echo "$SKC";; LAM) echo "$LAM";; NYM) echo "$NYM";; ISB) echo "$ISB";; DD) echo "$DD";; AL) echo "$AL";; MH2) echo "$MH2";; NH) echo "$NH";; C21) echo "$C21";; TF) echo "$TF";; SMK) echo "$SMK";; SG) echo "$SG";; CH) echo "$CH";; MN) echo "$MN";; MS) echo "$MS";; SDG) echo "$SDG";; BM) echo "$BM";; FAN) echo "$FAN";; AP) echo "$AP";; HAW) echo "$HAW";; FFL) echo "$FFL";; LMS) echo "$LMS";; GDN) echo "$GDN";; esac; }

manifest="found/video/clips.json"
echo "[" > "$manifest.tmp"
first=1
clips | while IFS='|' read -r name src start dur credit; do
  out="found/video/${name}.mp4"
  if [ ! -s "$out" ]; then
    echo "→ ${name} (${src} @${start}s ${dur}s)"
    ffmpeg -y -loglevel error -ss "$start" -i "$(resolve "$src")" -t "$dur" \
      -an -vf "scale=640:-2,fps=30" -c:v libx264 -crf 27 -preset veryfast \
      -movflags +faststart "$out" </dev/null
  else
    echo "✓ ${name} (cached)"
  fi
done
# manifest written in a second pass so a resumed run still emits every clip
{
  echo "["
  sep=""
  clips | while IFS='|' read -r name src start dur credit; do
    [ -s "found/video/${name}.mp4" ] || continue
    credit=${credit//\\/\\\\}; credit=${credit//\"/\\\"}   # JSON-escape backslashes + quotes (some credits contain ")
    printf '%s  {"file":"%s.mp4","credit":"%s"}' "$sep" "$name" "$credit"
    sep=",
"
  done
  echo ""
  echo "]"
} > "$manifest"
rm -f "$manifest.tmp"
echo "Done. $(ls found/video/*.mp4 2>/dev/null | wc -l) clips in found/video/ + clips.json"
