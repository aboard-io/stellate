# MATERIALS.md — the 30-genre invention commission (Phase A → Phase B work order)

Thirty ridiculous fictional genres, drafted in `genre-specs/*.json.draft`. This
file is the **materials crew's (Phase B) work order**: per-genre signature-crate
plans (espeak synthesis, archive.org fetches, reuse notes), the star-position
table, and two structural notes the insertion crew must handle before running
`genre-tool.js create`.

Every draft is **already valid against the live vocabulary** (all
progressions / kits / fills / synth-models / DX7-patches / samplers / forms /
found-roles / stab+hit patterns / sample-ids verified by
`scratchpad/gen30.js`), and every one **renders + measures** through
`genre-verifier.js` (bpm 59–187, drumDensity 0.0–2.6 — a deliberately wide
feature spread; see the distinctness table at the bottom). The drafts reference
**only existing sample ids** so they insert and verify TODAY; the signature
crate below is the *upgrade* — Phase B fetches/synthesizes the new material,
adds the ids to `SAMPLES` (and the fetch recipes), then repoints the marked
`found.sources` / `hits.sources` / `sampleEvents.pool` / `vox.sources` fields
and renames `.json.draft → .json`.

---

## TWO HARD NOTES FOR THE INSERTION CREW (read first)

### 1. Chart expansion is MANDATORY — the logical space must grow 500×400 → 720×520

`explorer.html` hard-codes a **500×400 logical canvas**: coordinates are drawn
`X = x*rb.width/500`, `Y = y*rb.height/400`, and `clampZoom()` / `toXY()` clamp
pan+zoom to that box. The 63 existing stars already fill it densely (occupied
x 30–498, y 35–375); at the ≥55px crowding law only ~13 more fit inside.
**30 more do not fit** without expanding the logical bounds.

The 30 new stars therefore colonize **two new territories outside the old box**:
an **Eastern continent** (x 555–685) and a **Southern shore** (y 435–495). To
make them reachable, Phase B must bump the logical divisors **500 → 720** and
**400 → 520** everywhere in `explorer.html` (the `x=>…/500`, `y=>…/400` scalers
at ~L686, the `toXY` inverse at ~L763, the waypoint draw at ~L779/L890, and any
`Math.min(500,…)`/`Math.min(400,…)` in `clampZoom`). This is a pure rescale:
every existing star keeps its logical coords and simply sits at a smaller
*fraction* of the wider canvas (existing max x 498 → 498/720 = 69% instead of
99.6%), which opens the east + south. **Pan-clamp implication:** with the wider
box, 1× zoom fits the whole expanded map; the new continents are reached by
panning at higher zoom, exactly as the SE corner is today. `SNAP=26` (logical
units) is unchanged, and all 30 new stars are ≥55px (logical) from every
neighbour, so snap radii never overlap — no blur.

`genre-tool.js splicePosition()` also enforces the ≥55px rule and reads the
same POS table; it will accept all 30 coords as-is (pre-verified in
`gen30.js`). Do the divisor bump **first**, or the new stars render off-canvas.

### 2. `genre-tool.js` form-discovery regex is stale — patch it or the create gate false-fails

`buildVocab()` derives valid forms via `/c\.form===?"([a-z]+)"/g`, which now
matches **only `"pop"`** (the kernel switched to `FORMS[c.form]` lookup at
`genre-kernel.js` L2008). So `validateSpec` rejects any anchor whose `form` is
`wave` / `dj` / `drop` / `ritual` / `anthem` — including the already-committed
hogcore (`drop`) and prelude (`wave`). Several of these 30 use those forms
(all are real `FORMS` keys — verified). Before running `create`, either:
(a) patch `buildVocab`'s forms line to `forms: new Set(Object.keys(...FORMS))`
(scrape `const FORMS={…}`), or (b) run `create --skip-gates`-style with the
form check relaxed. This is a pre-existing genre-tool bug, not a spec defect.

---

## STAR-POSITION TABLE (30 stars, expanded 720×520 logical space)

**Eastern continent** — the "New Territories": institutional up top, occupational
and obsolete-tech in the middle, fictional-places and the slow animals down the
east coast. Columns x = 555 / 620 / 685; rows y = 50…350 (step 60).

| genre | [x,y] | row theme | nearest existing star (px) |
|---|---|---|---|
| holdmusic | [555,50] | institutional | disco (92-score neighbour) |
| termswave | [620,50] | institutional | spokenword / vaporwave region |
| surveywave | [685,50] | institutional | chiptune ~76px |
| dmvstep | [555,110] | institutional/queue | garage region |
| elevatorcore | [620,110] | institutional | transitwave neighbour |
| umpirehouse | [685,110] | occupational | (east of psytrance) |
| airtrafficdrone | [555,170] | occupational | (east of minimal/industrial) |
| auctioncore | [620,170] | occupational | (east of krautrock) |
| towncrier | [685,170] | occupational | (east of industrialmetal ~62px) |
| dialupgabber | [555,230] | obsolete-tech | (east of industrial ~90px) |
| faxbossa | [620,230] | obsolete-tech | — |
| crtwave | [685,230] | obsolete-tech | — |
| floppycore | [555,290] | obsolete-tech | — |
| zubrovia | [620,290] | fictional-place | — |
| lunapolka | [685,290] | fictional-place | — |
| atlantidrone | [555,350] | fictional-place | — |
| whalejazz | [620,350] | slow-animal | — |
| crickettempo | [685,350] | slow-animal | — |

**Southern shore** — domestic absurdism + food + the fast animals. Rows y = 435 / 495.

| genre | [x,y] | theme | nearest existing star (px) |
|---|---|---|---|
| dishwasherwave | [70,435] | domestic | dinosynth ~102px, wintersynth region |
| thermostatwave | [160,435] | domestic | (below spokenword/exotica) |
| microwave | [250,435] | domestic-liturgical | (below arabpop) |
| ikeacore | [340,435] | domestic | (below hogcore/surfrock) |
| laundrycore | [430,435] | domestic | (below jungle) |
| cerealwave | [520,435] | food | (below breakcore) |
| sourdough | [70,495] | food | — |
| hotsaucecore | [160,495] | food | — |
| aldente | [250,495] | food | — |
| pigeonstep | [340,495] | fast-animal | — |
| chickadeecore | [430,495] | fast-animal | — |
| magpiehouse | [520,495] | fast-animal | — |

All 30 are ≥55px from all 63 existing stars **and** from each other (checked in
`gen30.js`). The two blocks sit in currently-empty canvas, so separation from
the existing constellation is guaranteed by construction.

---

## PER-GENRE SIGNATURE-CRATE PLAN

Conventions: **espeak** = synthesize locally with `espeak-ng` in the marked
section of `fetch-found-samples.sh` (GPLv3 output, no license encumbrance —
same path as the hogcore `hp_*` cast); keep all texts **original/parodic**, no
copyrighted lyrics. **archive.org** = add a curl+ffmpeg entry to
`fetch-found-sound.sh` (bed/one-shot) with a PD/CC-BY source. **reuse** = the
existing id the draft already points at (plays today; optionally keep as a
secondary layer). Each entry ends with the **REPOINT** action: which anchor
field to swap once the new ids exist.

### Institutional / bureaucratic

**holdmusic** — *the call that never connects.*
- espeak `sp_hold_1..4` (a soothing corporate contralto, e.g. `en-us+f3 -s150 -p60`), telephone-band 300–3400 Hz filter like the transitwave PA:
  - "Your call is important to us. Please continue to hold."
  - "Thank you for your patience. A representative will be with you shortly."
  - "Did you know you can find answers to most questions on our website?"
  - "You are now caller number twelve in the queue."
- REPOINT: `hits.sources`→`["sp_hold_1","sp_hold_2","sp_hold_4"]`; `sampleEvents[0].pool`→`["sp_hold_1","sp_hold_2","sp_hold_3"]`. (draft reuses `sp_system`/`sp_herenow`.) DX7 **PAN FLUTE** is the smooth-jazz hook instrument — keep.

**termswave** — *the drone of consent.*
- espeak `sp_eula_1..3` (flat monotone, `en+m2 -s170 -p35 -a120`), original parodic legalese:
  - "By pressing play you agree to be bound by these terms, which may be updated at any time without notice."
  - "You waive the right to a jury trial and agree to binding arbitration in a venue of our choosing."
  - "We may collect, retain, and share your listening data with our partners and their partners."
- REPOINT: `found.sources`→`["sp_eula_1","sp_eula_2","sp_eula_3"]` (role `narration`). (draft reuses `vx_burroughs`/`vx_whitman` spoken-word as the placeholder monotone.)

**dmvstep** — *now serving B-47.*
- espeak `sp_dmv_1..6` (dead PA baritone, `en+m4 -s150 -p40`, telephone-band): "Now serving number B-47 at window four." / "Ticket A-12, please proceed to counter two." / "Now serving… C-90." / "Please have your paperwork ready." plus bare numbers "forty-seven," "ninety."
- REPOINT: `found.sources` + `hits.sources` + `sampleEvents[0].pool` → the `sp_dmv_*` set. (draft reuses the Conet numbers-station SOURCES `vx_conet_poacher/swedish` as the counter voice — thematically perfect, keep as an optional layer.)

**elevatorcore** — *going up.*
- espeak `sp_floor_1..6` (bright hostess, `en-us+f2 -s160 -p65`): "Going up. Third floor: ladies' outerwear." / "Second floor: housewares and gifts." / "Doors closing." / "Fifth floor: fine china, and the observation deck." Each rides the `thunk` per-floor key bump.
- archive.org: a woodblock/elevator "ding" one-shot — or synthesize (see `tw_ding`). REPOINT: `hits.sources`→`["sp_floor_1","tw_ding",…]`. DX7 **VIBE 1** + celesta lead is the Muzak signature.

**surveywave** — *on a scale of one to ten.*
- espeak `sp_survey_1..4` (peppy, `en-us+f4 -s175 -p70`): "On a scale of one to ten, how likely are you to recommend us?" / "Press one to continue in English." / "Your feedback helps us serve you better." / "Please stay on the line for a brief survey."
- **DTMF**: synthesize the touch-tone dyads (697+1209 Hz = key 1, etc.) as `dtmf_1..9` one-shots (ffmpeg `sine` mix, ~120ms) — the button-beeps ARE the hook. REPOINT: `hits.sources`/`sampleEvents[0].pool`→ mix of `sp_survey_*` + `dtmf_*`.

### Domestic absurdism

**dishwasherwave** — *cycle complete.*
- archive.org: search "dishwasher cycle field recording" / "kitchen appliance" (aporee / freesound-on-archive PD) → bed `dw_cycle` (the rinse-pump hum + heated-dry tick). espeak `sp_dw_done` "Cycle complete." (`en+f1 -s140`).
- REPOINT: `found.sources`→`["dw_cycle","factory"]`; `hits.sources`→`["sp_dw_done","tw_ding"]`. (draft reuses `factory` hum + `tw_ding`.)

**thermostatwave** — *who touched the thermostat.*
- archive.org: "furnace hum" / "HVAC drone" / "air conditioner room tone" → bed `hvac_hum`. espeak `sp_therm_1..3` (clipped, passive-aggressive, `en+m1 -s150`): "It's fine. I'm fine." / "I set it to sixty-eight for a reason." / "Someone has been touching the thermostat."
- REPOINT: `found.sources`→`["hvac_hum","factory"]`; `hits.sources`→`["sp_therm_1",…]`.

**microwave** — *grace before microwave.*
- espeak `sp_grace_1..2` (reverent, slow, `en+m3 -s120 -p45`): "For this reheated bounty, and the leftovers of Tuesday, we give humble thanks." / "Ninety seconds, on high. Amen."
- **the beep**: synthesize the microwave "beep beep beep" as `mw_beep` (three 2kHz square blips) — lands on the amen cadence. REPOINT: `hits.sources`→`["mw_beep"]`; `sampleEvents[0].pool`→`["mw_beep"]`; optional `vox.sources`→`["sp_grace_1","sp_grace_2"]`. (draft reuses `tw_ding` as the beep + `ahh_choir` sampler pad for the hymn.)

**ikeacore** — *some parts left over.*
- espeak `sp_flatpack_1..5` in a mock-Nordic register (`sv` voice if installed, else `en+m5 -s150` with invented product names): "BJÖRKENHÖLM." / "Insert cam-lock D into panel A." / "Step six of six." / "You will need a person you trust." (numbers as the wordless melody).
- archive.org / foley: cam-lock click + allen-key ratchet one-shots `cam_click`, `allen_key`. REPOINT: `found.sources`/`hits.sources`→ `sp_flatpack_*` + `cam_click`. (draft reuses Swedish station names `sp_st_slussen/centraal` as the placeholder voice.) Metal-only hat kit is the Allen-key percussion — keep.

**laundrycore** — *do not overload.*
- archive.org: "washing machine spin cycle" / "tumble dryer" → the accelerating-spin bed doubles as a break texture `dryer_spin`. espeak `sp_laundry_1..2`: "Tumble dry low." / "Do not overload the drum." / "Unbalanced load."
- REPOINT: keep `found.role:"break"` on the Amen (`amen_170/172/175` — the real breakbeat engine), add `hits.sources`→`["sp_laundry_1","tw_ding"]` and optionally layer `dryer_spin` as a `bed`. (draft already rides the Amen + `tw_ding`.)

### Animal genres (the melody IS the bird)

**pigeonstep** — *the rock dove's five-note coo.*
- archive.org: search "feral pigeon coo" / "rock dove Columba livia call" (Xeno-canto has CC-BY pigeon recordings mirrored on archive; or aporee urban wildlife) → `pigeon_coo`. Transcribe the coo to seed the lead motif (Phase B or a follow-up can hard-code the interval; the draft approximates with DX7 **VOICE 1**/**PAN FLUTE**).
- REPOINT: `found.sources`→`["pigeon_coo","loon"]` (bed). Keep the 2-step garage skeleton.

**chickadeecore** — *fee-bee, a descending minor third.*
- archive.org: "black-capped chickadee fee-bee song" (Xeno-canto CC / Cornell PD-adjacent — verify license) → `chickadee`. The interval (a whole descending m3, ~D→B) is the melodic law — draft states it with DX7 **GLOKENSPL** + celesta; a follow-up can pitch-map the real sample.
- REPOINT: `found.sources`→`["chickadee","frogs"]`.

**magpiehouse** — *one for sorrow; steals from everyone.* PURE REUSE, no new fetch.
- The joke is theft: the `chops`/`hits`/`sampleEvents` pools loot **existing** crates from across the catalog and rotate them — a stab (`bb_stab_a`), a rave shout (`rave_a`), a Potter name (`hp_luna`), a station (`sp_st_ginza`), a numbers-station (`vx_conet_*`). Phase B may **widen** the steal-pool with any ids it adds for the other 29 (that's the running gag — the magpie's nest grows as the commission does). No REPOINT required; optionally append 3–4 of the new `sp_*` ids to each pool.

**crickettempo** — *the tempo is the temperature (Dolbear's Law).*
- archive.org: "snowy tree cricket chorus" / "katydid night" (PD nature recordings) → `crickets` bed. The conceit lives in the info string + the warm 76–90 bpm band; the marimba "kalimba" answers the field.
- REPOINT: `found.sources`→`["crickets","frogs"]`.

**whalejazz** — *trading fours with a humpback.*
- archive.org: **NOAA / PMEL humpback whale songs are US-gov PUBLIC DOMAIN** (search "NOAA humpback whale song" / "SanctSound") → `whale_song`. Placed as call-and-response with the tenor sax (`sampleEvents` `placement:"response"` if a follow-up adds it; draft keeps it a bed).
- REPOINT: `found.sources`→`["whale_song","iriomote"]`. Tenor-sax sampler lead is the quartet — keep.

### Food genres

**cerealwave** — *part of a complete breakfast.*
- espeak `sp_cereal_1..3` (hyper cartoon mascot, `en-us+f5 -s185 -p80`): "They're grrreat, and legally distinct!" / "Part of this complete breakfast." / "Now with more crunch!" (original — avoid real slogans/mascots).
- **the snap**: the built-in `crackle` fx (already dialled to 0.4–0.7) IS the milk-hitting-cereal snap-crackle-pop — no sample needed. REPOINT: `hits.sources`→ mix `sp_cereal_*` + existing `rave_*`.

**sourdough** — *a starter is alive.*
- archive.org: "fermentation bubbles" / "yeast culture" / "bread starter bubbling" (or reuse a slowed water/mud recording) → `ferment_bubble`. Sparse bubble events over the 32-bar drone.
- REPOINT: `found.sources`→`["ferment_bubble","iriomote"]` (bed, low pitch). (draft reuses `frogs`/`iriomote`.)

**hotsaucecore** — *the Scoville escalation.*
- espeak `sp_scoville_1..5` announcing the heat each section (`en+m4 -s160`): "Jalapeño. Eight thousand Scoville." / "Habanero. Two hundred thousand." / "Ghost pepper. One million." / "Are you sure?" The escalation = the `distort` inserts (already on bass+lead) opening across sections.
- REPOINT: `hits.sources`/`sampleEvents`→ `sp_scoville_*`. Trumpet sampler + phrygian-dominant vamp = the Latin heat.

**aldente** — *remove from heat; do not rinse.*
- **the timer**: synthesize a kitchen-timer "ding" (single 4kHz bell, ~1s) as `timer_ding` if a distinct one from `tw_ding` is wanted; lands on the one via `sampleEvents placement:"cadence"`. Otherwise the draft's `tw_ding` is fine — this genre is 90% skeleton (11-minute minimal-techno boil / DJ plateau), 10% sample.
- REPOINT (optional): `hits.sources`/`sampleEvents`→`["timer_ding"]`.

### Obsolete-technology elegies

**dialupgabber** — *the 56k handshake as a kick.*
- archive.org: "dial-up modem handshake" / "56k connection sound" (widely mirrored PD-adjacent recordings — verify) → `modem_handshake`. The negotiation screech is chopped into the drop; the connection-drop is the breakdown.
- REPOINT: `found.sources`/`hits.sources`→`["modem_handshake", …existing rave_*]`. The `distort` bass insert (already added) is the weaponized screech.

**faxbossa** — *serenading a dead fax machine.*
- archive.org: "fax machine tone" / "CNG calling tone 1100 Hz" / "fax handshake" → `fax_tone` (held as the wistful pad motif). espeak optional `sp_fax_nocarrier` "No carrier."
- REPOINT: `found.sources`→`["fax_tone","tokyo_station"]`; optional `hits.sources`→`["fax_tone","tw_ding"]`. Nylon-guitar bossa is the serenade — keep.

**crtwave** — *mourning the tube.*
- archive.org: "CRT television whine" / "flyback transformer 15kHz" / "degauss" → `crt_whine` (the high drone) + `degauss` (the "boinnng" kick). Both can also be synthesized (15.7kHz sine + a pitch-swept resonant thump) — the draft synthesizes with a high sine lead + boom kick.
- REPOINT: `found.sources`→`["crt_whine","highway_night"]`; optional `hits.sources`→`["degauss"]`.

**floppycore** — *do not remove the disk.*
- archive.org: "floppy disk drive sound" / "3.5 inch seek" / "floppy read write" → `floppy_seek` (the head-stepper clatter = the break). espeak `sp_floppy_save` "Saving document. Do not remove the disk."
- REPOINT: `found.role:"break"` `found.sources`→`["floppy_seek","amen_165"]`; `hits.sources`→`["sp_floppy_save","tw_ding"]`. (draft rides the Amen.)

### Occupational

**airtrafficdrone** — *cleared to land.*
- espeak `sp_atc_1..5` in unflappable controller cadence (`en+m2 -s160 -p40`, mild radio EQ), original callsigns + phonetic/number strings: "Speedbird two-seven-heavy, cleared to land runway two-seven left, wind two-four-zero at eight." / "Contact ground point-niner." / "Hold at the outer marker." / "Squawk seven-thousand." / "Report established on the localizer."
- REPOINT: `found.role:"narration"` `found.sources`→`["sp_atc_1","sp_atc_2",…]`. (draft reuses the Apollo capcom loop `vx_apollo` — same deadpan register, keep as optional layer.)

**auctioncore** — *SOLD — the espeak-can-auctioneer joke.*
- espeak `sp_auction_1..3` at max speed to force the chant (`en+m6 -s280 -p55`): "do-I-hear-thirty-thirty-thirty-five-now-forty-forty-who'll-give-me-forty" / "SOLD, to the raver in the back." / "twenty-two-and-a-half-do-I-hear-twenty-five." The gavel = a wood-block one-shot `gavel` (or `tw_ding` in the draft, `placement:"cadence"`).
- REPOINT: keep `found.role:"break"` Amen; `hits.sources`→`["sp_auction_*","gavel"]`; add a buried `sampleEvents` chant pool of `sp_auction_*`.

**umpirehouse** — *STEE-RIKE THREE.*
- espeak `sp_ump_1..4` (gruff bark, `en+m7 -s150 -p35`): "STEE-RIKE THREE, you're OUT!" / "SAFE!" / "Ball four, take your base." / "Play ball!"
- The **ballpark organ** charge-riff is the `rock_organ` sampler lead (already set) + DX7 **60-S ORGAN**. REPOINT: `found.sources`/`hits.sources`→`["sp_ump_*","ca_horn"]` (the goal-horn `ca_horn` doubles as the stadium blast in the draft — keep).

**towncrier** — *OYEZ, then the drop.*
- espeak `sp_crier_1..3` (booming proclamation, `en-rp+m3 -s130 -p30 -a180`): "OYEZ, OYEZ! Hear ye, hear ye!" / "Be it known throughout the realm…" / "God save the bass!"
- The **handbell** = DX7 **BELLS**/**TUB BELLS** lead (already set) or an archive.org handbell one-shot `handbell`. The half-time **wobble** = the `wobble` bass model (set). REPOINT: `found.sources`/`hits.sources`→`["sp_crier_*","handbell"]`.

### Fictional places

**zubrovia** — *the anthem of a nation that isn't.*
- espeak `sp_zubrovia_1..3` singing INVENTED nonsense syllables (original — no real language), a massed-choir feel via layered `en+m1`/`en+m5`/`en+f2` at slow speed: "Zubróvya, Zubróvya, ho-zna-vímu tra-la!" (parodic pseudo-Slavic). The **Kolo-Skronk** national dance = the tribal/full kit + hijaz mode (set).
- REPOINT: `found.sources`/`sampleEvents[0].pool`→`["sp_zubrovia_*"]`. (draft reuses the real Soviet massed-choir SOURCES `vx_sv_choir`/`vx_sv_march` as the anthem placeholder — keep as an optional grandeur layer.) French-horn + DX7 **BRASS 1** = the state brass.

**lunapolka** — *oom-pah at one-sixth gravity.*
- espeak `sp_luna_1..2` (a toast, slight delay/float, `en+m4 -s140`): "To the colony! To the dome! To not going outside without a suit!" The low-gravity float = halftime feel + the long lead `release` (set).
- **the instrument IS the joke**: DX7 **ACCORDION** patch + `bandoneon` sampler (both set). REPOINT: `hits.sources`→`["sp_luna_1","sp_luna_2"]`; optional bed of `sp_lander`/space clips.

**atlantidrone** — *the drowned cathedral.*
- archive.org: "hydrophone ambience" / "underwater ocean" / "NOAA hydrophone" (PD) → `hydrophone` bed (the water column). The organ = `church_organ` sampler + DX7 **PIPES 1**; the bubble-choir = `ahh_choir` through the greyhole wash (all set); 32-bar plateaus (set).
- REPOINT: `found.sources`→`["hydrophone","iriomote"]`.

---

## NEW SAMPLE-ID CONTRACT (what Phase B adds to `SAMPLES` + fetch recipes)

espeak (add to the marked block of `fetch-found-samples.sh`, `kind:"speech"`):
`sp_hold_1..4`, `sp_eula_1..3`, `sp_dmv_1..6`, `sp_floor_1..6`, `sp_survey_1..4`,
`sp_dw_done`, `sp_therm_1..3`, `sp_grace_1..2`, `sp_flatpack_1..5`,
`sp_laundry_1..2`, `sp_cereal_1..3`, `sp_scoville_1..5`, `sp_atc_1..5`,
`sp_auction_1..3`, `sp_ump_1..4`, `sp_crier_1..3`, `sp_zubrovia_1..3`,
`sp_luna_1..2`, `sp_floppy_save`, `sp_fax_nocarrier`.

synthesized one-shots (`kind:"hit"`, ffmpeg-generated, like `tw_ding`):
`dtmf_1..9`, `mw_beep`, `timer_ding` (optional), `gavel`, `handbell` (or fetch).

archive.org fetches (add to `fetch-found-sound.sh`, verify license per item;
prefer PD — the whale/hydrophone/dial-up are the safest):
`dw_cycle`, `hvac_hum`, `cam_click`, `allen_key`, `dryer_spin`, `pigeon_coo`,
`chickadee`, `crickets`, `whale_song` (NOAA PD), `ferment_bubble`,
`modem_handshake`, `fax_tone`, `crt_whine`, `degauss`, `floppy_seek`,
`hydrophone` (NOAA PD).

Add the archive fetches to SOURCES/attribution in `SOURCES.md` on fetch, exactly
as the existing found-sound table does; flag any non-PD item for the human
decision before release (the ND/NC rule).

---

## FEATURE-SPACE DISTINCTNESS (measured, 4 seeds, vs committed targets)

The verifier identity of each — bpm band + measured drumDensity + the top
existing genres it scores near (its "musical parents"). The joke sample + the
per-genre `verify.features` weights are what fence each off its parent at
insertion (genre-tool auto-tightens the target row until no existing diagonal
is stolen). Deliberately wide spread: 59→187 bpm, dd 0.0→2.6, families from
drone→downtempo→house/techno→garage→jungle/breakcore/gabber.

| bpm | dd | genre | nearest existing (score) — the parents to separate from |
|---|---|---|---|
| 59 | 0.0 | atlantidrone | ambient 98, witchhouse 93, vaporwave 91 |
| 62 | 0.0 | sourdough | ambient 98, witchhouse 94, vaporwave 91 |
| 69 | 0.1 | crtwave | ambient 96, spokenword 92, vaporwave 91 |
| 69 | 0.3 | whalejazz | newage 92, downtempo 89, vaporwave 88 |
| 70 | 0.0 | termswave | vaporwave 95, ambient 94, dub 93 |
| 75 | 0.0 | microwave | vaporwave 100, newage 98, sovietwave 91 |
| 80 | 0.1 | airtrafficdrone | vaporwave 94, downtempo 93, dub 93 |
| 83 | 1.5 | faxbossa | downtempo 93, vaporwave 91, exotica 91 |
| 86 | 0.4 | crickettempo | citypop 94, vaporwave 93, downtempo 91 |
| 93 | 0.1 | thermostatwave | dub 92, industrial 90, sovietwave 88 |
| 105 | 0.3 | holdmusic | disco 92, citypop 92, exotica 89 |
| 105 | 1.3 | lunapolka | transitwave 94, italo 91, arabpop 91 |
| 109 | 1.5 | elevatorcore | transitwave 98, shibuyakei 96, italo 95 |
| 114 | 1.7 | hotsaucecore | house 92, italo 92, industrial 90 |
| 122 | 1.9 | ikeacore | techno 95, house 94, industrial 93 |
| 122 | 2.2 | zubrovia | dancepop 96, transitwave 94, italo 94 |
| 124 | 2.6 | dishwasherwave | techno 100, ebm 98, acidhouse 98 |
| 124 | 1.5 | surveywave | house 92, dancepop 92, edm 91 |
| 126 | 1.9 | aldente | techno 100, ebm 98, acidhouse 95 |
| 126 | 1.9 | magpiehouse | house 96, dancepop 92, techno 90 |
| 126 | 1.5 | umpirehouse | house 96, techno 90, canawave 88 |
| 132 | 1.6 | pigeonstep | garage 98, house 90, shibuyakei 89 |
| 134 | 1.6 | dmvstep | garage 95, house 87, bigbeat 84 |
| 144 | 1.2 | towncrier | psytrance 96, gabber 95, techno 92 |
| 147 | 1.9 | chickadeecore | gabber 94, psytrance 94, chiptune 88 |
| 153 | 2.2 | floppycore | jungle 91, bigbeat 86, breakcore 84 |
| 162 | 1.1 | cerealwave | gabber 92, hogcore 91, jungle 80 |
| 172 | 1.2 | laundrycore | jungle 99, breakcore 92, dubstep 83 |
| 175 | 1.3 | auctioncore | jungle 99, breakcore 91, dubstep 82 |
| 187 | 1.4 | dialupgabber | gabber 92, breakcore 79, techno 92 |

**Separation notes for the crew:** the drone/downtempo cluster (atlantidrone,
sourdough, crtwave, termswave, microwave, airtrafficdrone, thermostatwave) all
sit near ambient/vaporwave — they are fenced apart from each other and their
parents by (a) the *signature crate* (legalese vs ATC vs grace vs HVAC vs
hydrophone — the verifier reads `bedUse`/`chopUse`/`acoustic`) and (b) bpm micro-
bands (52–93) + `chordEvery` (16 vs 32) + `reverbColor` (greyhole vs spring vs
dattorro). The house/techno cluster (dishwasherwave, aldente, ikeacore,
magpiehouse, umpirehouse, surveywave) separates on `chopUse`/`pump`/`crackle`
and lead timbre (organ vs casio vs juno vs ppg). The fast cluster (cerealwave,
laundrycore, auctioncore, dialupgabber, chickadeecore, floppycore) spreads
across trap→jungle→breakcore→gabber by `breakUse` + `crackle` + kick model.
Run `node genre-verifier.js matrix` after each insertion; expect the auto-tighten
to add 1–3 discriminators per genre (as it did for hogcore).
