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

## Sampled instruments (found/samples/instruments/ — fetch-found-samples.sh, faust/sf2.js)

The SAMPLER voice model plays real instrument zones extracted from a SoundFont
at fetch time (SF2 → wav zones + zones.json with root keys and loop points;
the font itself is never committed or shipped).

| local dir | source | content | license |
|---|---|---|---|
| `alto_sax` `tenor_sax` `trumpet` `flute` `clarinet` `vibraphone` `strings` `nylon_string_guitar` `steel_string_guitar` `bandoneon` `acoustic_bass` `percussive_organ` `rock_organ` `trombone` `muted_trumpet` `oboe` `cello` `harp` `celesta` `ahh_choir` `fretless_bass` `harmonica` `church_organ` `honky_tonk` `french_horns` `jazz_guitar` `bright_yamaha_grand` `marimba` | **FluidR3 GM/GS** SoundFont by Frank Wen, via [`fluidr3-gm-gs`](https://archive.org/details/fluidr3-gm-gs) on archive.org | single-note multi-zone keymaps (6 zones each, SF2 loop points preserved) | **MIT** — FluidR3 is distributed under the MIT license (Frank Wen, 2000-2002; license text ships with the canonical FluidR3_GM.zip distributions, e.g. member.keymusician.com/Member/FluidR3_GM/). The archive.org item's CC-BY-ND tag is the uploader's, not the font's grant. |
| **the full General MIDI set** — all 128 bank-0 FluidR3 melodic presets (`faust/extract-gm.js`, 2026-07 "all of GM"): the acoustic families above plus `rhodes_ep` `legend_ep_2` `electric_piano` `yamaha_grand_piano` `violin` `viola` `contrabass` `slow_strings` `tremolo` `timpani` `ohh_voices` `solo_vox` `orchestra_hit` `clean_guitar` `palm_muted_guitar` `overdrive_guitar` `distortion_guitar` `guitar_harmonics` `soprano_sax` `baritone_sax` `english_horn` `bassoon` `piccolo` `recorder` `ocarina` `banjo` `koto` `shamisen` `fiddle` `dulcimer` `music_box` `xylophone` `tubular_bells` `tinker_bell` `picked_bass` `pop_bass` `slap_bass` `reed_organ` `brass_section` `bowed_glass` `space_voice` … | **FluidR3 GM/GS** (same font/item as above) | 105 usable multi-zone keymaps (6 zones each). The 24 single-zone presets (SFX, one-note synth pads, DrawbarOrgan) extract but are one-shot color only. Now the default sound: `state.sampledOnly` on by default, signature synths (tb303 etc.) exempt. | **MIT** (Frank Wen, as above) |
| `felt_piano` | **FluidR3 GM/GS** GM 0 "Yamaha Grand Piano" (same font/item as above) | 10-zone keymap (dense midrange — the neoclassical lead is exposed), made *felt* by baking a 3 kHz lowpass into the zone wavs at extraction (fetch-found-samples.sh; sample counts unchanged, SF2 loop points preserved). A derivative work of the FluidR3 samples, not a new recording. Chosen over external "felt piano" sample sets: no CC0/PD felt piano with verifiable provenance and per-note loop data was found (the well-known felt libraries — e.g. Spitfire LABS Soft Piano — are EULA-restricted, not redistributable). | **MIT** (Frank Wen, as above) |
| `drums/acoustic` `drums/room` `drums/power` `drums/electronic` `drums/jazz` `drums/brush` | **FluidR3 GM/GS** GM **bank 128** percussion (Standard / Room / Power / Electronic / Jazz / Brush kits; same font/item as above) | SAMPLED DRUM KITS — per-hit one-shots (kick/snare/hi-hats/toms + rim/clap/crash/ride), one recorded GM drum note each, at natural pitch (`faust/sf2.js drumkit`). Additive to the Faust synth kicks; genres opt in via `drums.kit` (genre-kernel `DRUMKITS`). Wavs gitignored/derived, `len` mirrored in `DRUMKITS`. | **MIT** (Frank Wen, as above) |

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
