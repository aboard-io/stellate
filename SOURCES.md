# Found-sound sources & attribution

The found-sound layer is **field recordings from [radio aporee ::: maps](https://aporee.org/maps/)**,
mirrored on the **Internet Archive**. The audio files themselves are **not committed** —
`fetch-found-sound.sh` downloads them and `royal-road.csd` granular-processes them
through `syncgrain` (time-stretched, pitched down, sent to the reverb).

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

## Recordings used historically (available to re-layer)

These appeared in earlier versions of the arrangement (as solo interludes /
transitions) and are wired as commented entries in `fetch-found-sound.sh`:

| local name | Internet Archive item |
|---|---|
| `tsukiji` | [`aporee_35166_40406`](https://archive.org/details/aporee_35166_40406) |
| `asakusa` | [`aporee_21091_24510`](https://archive.org/details/aporee_21091_24510) |
| a Paris market recording | (aporee) |

To re-introduce one: uncomment its line in `fetch-found-sound.sh` (fill in the
`.ogg` filename from the item's file list), add a matching `ftgen` + `instr 3`-style
voice in `royal-road.csd`, and re-render.

# Found-video sources & attribution

The background video layer (`video-layer.js`) crossfades between short clips cut
from **LaserDisc rips on the Internet Archive**. The clips are **not committed** —
`fetch-found-video.sh` is the committed recipe (it range-seeks each disc over
HTTP and re-encodes ~30s excerpts to small, silent 640px MP4s in `found/video/`).
Timestamps were hand-curated by sampling frames across each disc (2026-06).

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

The NASA material is public domain. The demo discs and Video Drug volumes carry
no explicit license; they're used here as brief, transformed, muted excerpts in
a non-commercial art context. Don't redistribute the clips as media — point
people at the recipe and the Archive items instead.

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

## Sampled instruments (found/samples/instruments/ — fetch-found-samples.sh, faust/sf2.js)

The SAMPLER voice model plays real instrument zones extracted from a SoundFont
at fetch time (SF2 → wav zones + zones.json with root keys and loop points;
the font itself is never committed or shipped).

| local dir | source | content | license |
|---|---|---|---|
| `alto_sax` `tenor_sax` `trumpet` `flute` `clarinet` `vibraphone` `strings` `nylon_string_guitar` `steel_string_guitar` `bandoneon` `acoustic_bass` `percussive_organ` `rock_organ` `trombone` `muted_trumpet` `oboe` `cello` `harp` `celesta` `ahh_choir` `fretless_bass` `harmonica` `church_organ` `honky_tonk` `french_horns` `jazz_guitar` `bright_yamaha_grand` `marimba` | **FluidR3 GM/GS** SoundFont by Frank Wen, via [`fluidr3-gm-gs`](https://archive.org/details/fluidr3-gm-gs) on archive.org | single-note multi-zone keymaps (6 zones each, SF2 loop points preserved) | **MIT** — FluidR3 is distributed under the MIT license (Frank Wen, 2000-2002; license text ships with the canonical FluidR3_GM.zip distributions, e.g. member.keymusician.com/Member/FluidR3_GM/). The archive.org item's CC-BY-ND tag is the uploader's, not the font's grant. |
| `felt_piano` | **FluidR3 GM/GS** GM 0 "Yamaha Grand Piano" (same font/item as above) | 10-zone keymap (dense midrange — the neoclassical lead is exposed), made *felt* by baking a 3 kHz lowpass into the zone wavs at extraction (fetch-found-samples.sh; sample counts unchanged, SF2 loop points preserved). A derivative work of the FluidR3 samples, not a new recording. Chosen over external "felt piano" sample sets: no CC0/PD felt piano with verifiable provenance and per-note loop data was found (the well-known felt libraries — e.g. Spitfire LABS Soft Piano — are EULA-restricted, not redistributable). | **MIT** (Frank Wen, as above) |

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
