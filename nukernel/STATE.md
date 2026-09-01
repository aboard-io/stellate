# STATE — where the box actually is, 2026-08-27

## THE SATURATION CAME DOWN, 2026-08-27, AND CHARACTER CAME OFF THE BOARD

Paul, listening on staging: *"voices seem to be mixed really hot and
saturated"*. Asked to let it be measured first: **"Just turn down saturation my
ears aren't wrong."** It was measured anyway — not to argue, but so the right
thing got turned down — and his ears were not wrong.

**WHERE THE SATURATION LIVES, established by rendering with each suspect
neutralised in turn** (`nukernel/export/_satpress.js`, the float-PCM press, driven
by `_satdrive.cjs`; six records, 8 bars, the shipped engine in the shipped
worker):

| stage | owner | value | reaches a modern record? |
|---|---|---|---|
| master `drive` → fx_bus `grit` | `fields.js` DRIVES → `desk.js` masterState | .12/.28/.5/.8 | **yes**, 39 of 199 anchors |
| master `tape` → fx_bus `tsat` | `fields.js` TAPES → masterState | .18/.30/.45/.60 | **yes**, 118 of 199 |
| fx_bus `tsat` default | state-engine `fxParams` | 0.18 | **yes**, every record |
| master `glue` → fx_bus `comp` | `desk.js` GLUE_COMP | .2….95 | **yes**, all 199 |
| fx_bus `clip` (Bram de Jong, 0.95) | `fx_bus.dsp`, unconditional | knee −6.47 dBFS, cap −2.94 | **yes, always — and it is the answer** |
| lane gains | `to-engine.js` LEVEL_LANES | ×2.2 / ×2.8 | **yes — the biggest lever measured** |
| `GLUES`' makeup, `CEILINGS`' push | `fields.js` | 1.2–2.2, 1.7/2.6 | **no.** `resolveMaster` has no caller; both render bit-identical when zeroed |
| per-voice strip `sat`/`satMix` | state-engine STRIP_PROFILES | .15–.34 | **no authority.** `sat: 0` and `sat: 1, satDrive: 12, satMix: 1` both land within 0.14 dB |
| `instruments.js` STRIPS (14 families) | `nukernel/instruments.js` | — | **WIRED 2026-08-28** (was: never handed to the engine). `to-engine.js` `recipeBase` carries the family strip over as `m.strip`; the parent's `stripFor` takes it as the base, REPLACING the role profile, for every pitched non-bass sampled voice. Reaches 8 families over 139 of 204 records (keys 53 chairs, guitar 53, strings 47, brass 32, reed 28, organ 21, bowed 10, mallet 4). Band move on 6 spanning records: 300–3k −0.04…+1.36 dB, 2–8k −1.10…+0.14 dB, peak −0.01…+0.72 dB, no new clipping. `dirty` and `vox` still reach nothing — their ids resolve to MODELS (stk_guitar, voice_choir), not to the sampler |

**THE MECHANISM.** Five of the six records peaked between −3.16 and −4.09 dBFS
— *inside the soft clip's knee, within 1.2 dB of its asymptote*. The proof it
is a clip and not a mix: trimming the input barely moves the peak and moves the
**crest** instead. So "hot" and "saturated" are one fact, and the owner of the
fact is the gain staging.

**WHAT MOVED.** Two tables, each at its one owner, no global trim:
`to-engine.js` LEVEL_LANES × 0.75 uniformly (−2.50 dB, clamps included — the
clamps move or the cut is a rebalance), and `fields.js` DRIVES down ~40%
(`hair` .12→.06, `warm` .28→.16, `dirt` .5→.32, `crush` .62 and still
crushing). **Measured before/after, one build, one binary:** crest recovered
**+1.15 to +1.83 dB** on the five records that were sitting on the clipper, RMS
down 1.1–2.0 dB; `ambient`, which peaked at −9.4 and was never near the knee,
took the trim and recovered 0.21 dB — the control the theory predicts.
Audible-sized, not cosmetic. **`ABSENT IS TODAY` was expressly suspended:
records render differently on purpose.**

**AND CHARACTER CAME OFF THE BOARD.** *"Get rid of the character from the
board."* The data path had already been retired that morning; what remained was
the control. `ui/engineer.js`'s `master.fx` multiselect — the page's ONE
`<select multiple>` and the only control that needed a ⌘ gesture — is gone,
with the tombstone in place; `.nu-rec` went with it, and the main plate now
reads drive / glue / tape / space / width / tilt / ceiling, record gain, meter,
listening, and nothing empty. Every gate assertion that named it was **rewritten
in place, not deleted**: `test/sheets.js` (the multiselect count split between
the shipped page and the harness), `test/selects.js` (two notes), `desk-gate`
G11 §2b, `test/tape-reach.test.js` (`boxFxOf` had already broken it), and R6,
whose subject — "levelOf reproduces the four historical scalings" — is exactly
what Paul asked to change, so it now asserts the SHAPE of the table and the
UNIFORMITY of the turn-down instead of nine literals.

## FOUR GATES CAME BACK RED TODAY, AND IN ALL FOUR THE PAGE WAS RIGHT

Start here, because the previous edition of this file earned whatever trust it
has by opening on its own failures.

`node test/all.js --complete` — **18 gates, nothing sampled, nothing cached, the
pass that gates a deploy** — was run today at 21:27 and came back **14 pass ·
4 fail · 0 skip**. **Not one of the four failures was a defect in the page.**
All thirteen failing assertions were transcripts of designs a later round had
changed on purpose, most of them on Paul's own instruction. Every one has been
rewritten to assert the new truth with the reason attached — **none deleted,
none relaxed, each carrying above it the sentence it used to make** — and the
repairs are committed as `2c0454d`, *"the gates catch up with the page they
measure."* **A second full `--complete` run on the settled tree came back
18 pass · 0 fail · 0 skip.** Nothing is red tonight, and the sentence is only
worth anything because of what is written above and below it.

* **`atlas`, 6 of 103.** **Four** of the six (G8, G16, G19, G22) compared
  `#title` with the exact string `"Kingston 1969"`. Since the wiki round it
  reads `"Kingston 1969 Reggae"`, because Paul asked for the article link *"at
  the top by the title"* and `ui/eight.js draw()` appends the
  `<a class="nu-wiki">` to that same element. The tap itself worked — G22's own
  ring assertion passed in the same run off the same click, which is how you
  can tell a stale string from a broken page. **The other two were the catalog
  growing:** the gate asserted Tokyo has no mark at 1969 and the world round
  added **enka, Tokyo 1969**; and it walked twelve Tabs looking for Kingston,
  on a year that went from 33 drawn marks to 45.
* **`motif-frozen`, 4 — two at 390 px and two at 1400 px.** A2 asserted *"a
  composed staff over every written one while STOPPED"* — the
  two-staves-per-measure layout of 2026-08-24. Paul killed it the next morning:
  *"you don't need to show me the interpreted notation for a motif, only the
  pure representation, because now I have the sheet music."* `ui/eight.js`'s own
  header says the `data-live="played"` value *"existed for one day … and it is
  gone"*, and `__eightCaptions` was rewritten with a note explaining what it
  reads instead. **The page updated its own probe and its own prose; nobody
  updated the gate.** Every promise A2 exists for still held in the same run —
  A3 byte-identity, A4 the caption moving, A5 nothing moving, A6 no redraws,
  A7 no long task.
* **`sheets`, 2 of 28** and **`selects`, 1 of 52.** The same move from two
  sides. The character chips came off the instruments (Paul: *"Don't let me add
  effects to instruments. That's bus and board stuff"*) and got an address on
  the board as `master.fx`, because that chain is the RECORD's — `audio/desk.js`
  hands it to every seated voice. `test/sheets.js` had not been told the new
  key. `test/selects.js` was worse: it **demanded a control be present on a page
  where `desk-gate` — green at 123 checks in the same run — demands its
  absence.** Two gates, one fact, opposite claims. That file is `#app`-scoped on
  purpose and the board belongs to `desk-gate`, so the entry is gone from here
  rather than followed.

Two of the repairs now **derive** the fact they were typing — the atlas gate
asks the page which year Tokyo holds no record in, and how wide the drawn set
is, instead of remembering — so they cannot go stale the next time the catalog
grows. And one of the repairs **broke its own gate on the way through** (an
emptied table whose reader assumed a first row), which is recorded in the laws
below rather than quietly fixed.

**THE ONE THING WORTH TAKING FROM THIS, and it is why the count was four rather
than one:** the last `--complete` run on record before today was 2026-08-25,
and the last gate of that day's suite exited at 14:14. **Six commits landed
after that** — `55ae623`, `6ddd43b`, `0c58a6a`, `70e2ee4`, `2151c1d`,
`9b76f77` — three of them reversing a design on Paul's word. **A gate is a
transcript of a decision, and a reversed decision leaves a red gate behind
whether or not anybody looks.** The suite takes twenty-six minutes. Run it
before you believe a tree.

## AND ONE THING NOBODY MEASURED TODAY, ON PURPOSE

Paul, today: *"Don't do the soak."* The soak is the only thing that can
measure starvation, dropouts, heap and keep-up, so **this file makes no claim
about audio health.** The last numbers stand with their date on them:
`GLOBE.md`, 2026-08-24 evening, twelve minutes with the globe on screen —
**SOAK PASSED, all eight checks, `episodes=0`, `keepUp p05 = 1`, readout
`runway 8.4s · no dropouts`.** Two rounds have changed the master chain and
the voice fleet since. Nobody has re-measured. If you want the claim, the soak
is the way.

---

## WHAT THIS IS

nukernel is a song box. A record is **one value with eight axes** — Time,
Alphabet, Material, Development, Form, Cast, Sound, Performance (`AXES.md`) —
and everything else is a view of that value. You turn a globe, pick a place
and a year, and the box writes a whole record there; you read it as a page of
questions and answers, edit any of them, and the band plays. There are **199
anchors** across **109 places and 85 years, 540 to 2023**. One engine plays it
(the parent's FaustLive), one mixing board sits at the foot of the page, one
producer speaks in sentences, and one exporter writes an Ableton set. Nothing
on the page fetches anything: every table it reads was derived offline and
committed.

**How to read the page.** It is one long scrolling document, seven blocks
deep: the atlas at the top (a when-slider and a globe you turn), then the five
axis sections, then the mixing board. Everything is a real HTML control with
its label in the DOM — **the page must read as the same document with the
stylesheet off, top to bottom**, and a gate asserts that. An option you cannot
choose is greyed and **prints the reason in its own words**; that greying is
EXTRACTED by compiling records, never typed. Nothing changes under your hand
while the record plays except the things that declare themselves live.

**The order to read the files in.** `AXES.md` first (the vocabulary, 127
lines). Then this file. Then `PROGRAM.md` for the contract the 2026-08-24 round
was built against — its counts are stale, its contract is not. The deep reports
are listed at the foot, each with how far it can be trusted.

---

## WHAT WORKS, WITH THE NUMBER THAT PROVES IT

### The catalog grew by 43%, and it says where it stopped

**139 anchors → 199.** Sixty new ones — son Havana 1928, choro Rio 1900, mento
Kingston 1952, shidaiqu Shanghai 1940, kroncong Jakarta 1935, filmi Mumbai
1960, rebetiko Piraeus 1935, ragtime Sedalia 1899, sacred harp Philadelphia
1844 — and the Euro-American share goes **86.3% → 61.7%**. The era laws
written for the African round held under a 43% expansion: **zero out-of-period
hires across 597 records.**

**The one empty region is empty for a reason that is not musical.** Australia
and the Pacific has no dot because `atlas-land.js` bakes Natural Earth
*physical* land and holds no Pacific islands, no Ryukyus, no Lesser Antilles.
Four Tier-1 anchors were written and **withdrawn** because no dot for them can
be proved on land: hapa-haole (Honolulu, 33.9° from the nearest baked
coastline), Melanesian string band (Honiara 9.0), zouk (Pointe-à-Pitre 5.5),
Okinawan pop (Naha 5.3). All four are 12-TET, in four, and castable. **One
re-bake of the coastline unblocks half that row**; the other half is blocked
musically and says so. See `WORLD.md` for the tier rules and the `cannot`
field.

### Every genre has a Wikipedia link, resolved against a local Wikipedia

**191 links, 2 deliberate misses, 6 internal roles never linked** — 160 genre
articles, 20 artist, 7 broader, 4 work. Derived once by
`nukernel/wiki-extract.js` against `wikipedia_en_all_maxi_2026-02` served by
`kiwix-serve` on this box, committed as `nukernel/wiki.js`, and re-derivable:
`test/all.js`'s `wiki` gate re-runs the whole derivation against the ZIM and
fails if it drifts — it did so twice today. **A link is not a fetch** — the offline law is
untouched, and `test/atlas.js` G7 still aborts every non-localhost request and
stays green with 191 hrefs in the DOM.

Disambiguation was the whole job and the file is written to be read:
`nukernel/WIKI.md` carries, for every row, the argument from the anchor's own
facts and the first sentence of the article, so a human can check it by
reading. Five automatic rejections each caught a real mistake, the best of
which is the commit's title: **`Zema` is a genus of Asian planthoppers.** Also
caught: kiwix serves a redirect-to-fragment as a meta-refresh stub an
HTTP-status check cannot see, so five rows were silently landing on a SECTION
rather than an article. It refused to guess twice — `synthduo` gets no link
because *"guessing at Erasure or the Pet Shop Boys would be inventing a fact
the table does not hold."*

### The record's own sound finally arrives

Paul, by ear: *"you keep assigning 'solo vox' but should be using native
voices where possible."* **The round's own first number was wrong and it said
so.** It reported *"NATIVE seats: 0 of 1,226 (0%)"* — that measured
`document.js nativeOf`, the DOCUMENT seam. What actually sounds is resolved
four tables later, and through the engine's own `recipeFor` **63.9% of chairs
were already Faust models**, including all 699 `solo_vox` seats, which resolve
to `voice_lead` at breath 0.042 and not to a sampled breathy singer. So the
hiss diagnosis was wrong for `solo_vox`. **The bug underneath was narrower and
worse.**

`precompose` names an instrument for **every** chair (3,228 of 3,228), the
document turns that into `chairs[v] = { instr }`, `derive.js` returns it as
`over`, and `audio/plan.js:207` read

    gsyn = font || (over ? null : ((chSeat && chSeat.synth) || G.synth))

so a non-null `over` **nulled the record's signature synth on every chair of
every precomposed record**. All **15 anchors that declare a `synth` block were
silenced.** The catalog has always played right when rolled — a genre sets no
`chairs`, so `over` is null — and precompose was the outlier.

    native seats        2062 (63.9%) -> 2485 (77.0%) of 3,228 line chairs,
                        over 199 anchors x 3 seeds
    the record's own    0 chairs -> 72, all 15 anchors  (re-counted today:
                        still exactly 72 chairs in exactly 15 anchors)
    sampled / unrouted  1166 -> 743, and that number is NOT a backlog
    worst record cost   36.80 -> 42.00 against a budget of 40
    industrialrock      lead_fuzz, module fuzz, drive 0.85, verbatim
    gregorian           ahh_choir -> voice_choir, MOUTHS.plainchant
    also restored       acid->tb303 · vaporwave->dx7_alg5 · kraftwerk,
                        motorik, roboticpop, ebm->modeld · synthduo->juno60

`ahh_choir` (381 chairs) and `ohh_voices` (39) had no PATCH row at all, so
`to-engine.js`'s entire `choir` branch and the `blend` dial that `genres.js
MOUTHS` writes on ten rows had **never once executed.** The cost is one record
of 597 over budget; the gate asserts a stated ceiling of 43 and prints the
over-budget list every run, because `trimToBudget` runs
before nukernel adds its chairs and so nothing sheds them. Three records would
have been worse and were fixed by a musical rule rather than a budget dodge:
**a guest does not bring a SECOND choir, it joins the section already seated.**
The new census counts native seats on every run, so this can never silently
return to zero.

### The voice has 247 controls, every one measured

`nukernel/knobs.js` is **GENERATED**, not typed: **247 controls across 27
voices**, every key probed at both ends, dead travel trimmed, `derived`
recorded so a knob shows the number it is overriding, `gate` carrying its own
measurement (*"artic is a 10 dB control at babble 0.4 and a 0.1 dB one at
babble 1"*), and `quiet` for a key that exists and is silent. The published
range is the outermost pair of values at which the parameter still moves, so
**no slider on this page has a stretch at either end where nothing happens.**
`test/knobs.js` passes **94 checks** and asserts every one of the 247 moves a
parameter. Vowels are letters, never numbers. A take and a seed exist at last.

**FM was never expensive — it was unreachable.** `fm2op` had no SYNTH row, no
PATCH row and no string a document could write; one line seats it and the
instrument menu goes **108 → 109**. Its four FM constants became real
controls, and the measurement says what was wrong: at the shipped `idx1` of
1.0 the whole ratio range moves the centroid **365 → 469 Hz**; at `idx1` 6 the
same sweep sits at **847 → 914**. RMS is 0.22 at all six. **Brightness, not
loudness — it was turned down, and nothing could turn it up.**

### A throat you can drag, and the picture IS the measurement

Paul: *"Do you think you could come with a nice radial graph structure for
editing the voice so I can work on multiple dimensions"* — and, when the
geometry was put to him, *"I'm fine with the pad idea for the voice editor."*
So it is a **2-D pad with a ring of spokes around it**, and the argument for
that shape is in the code: a spider chart gives every parameter one spoke and
one number, which is what the table under it already does drawn round instead
of down. **`tongue` and `tongueD` are not two numbers** — they are a POSITION
and a DIAMETER at that position, one constriction with two coordinates, and the
vowels sit at particular PLACES in that plane. Separated onto two spokes,
*"move the constriction forward while opening it"* is two gestures and the
plane you are moving in is invisible.

**And it is the answer to "why doesn't the tongue work", which is why it
exists.** `tract_voice.dsp:104` crossfades your `tongue` against THE VOWEL
TABLE's by `artic`, and that against THE BABBLER's by `babble`; the chant's
cantor ships `artic: 0.45, babble: 0.4`, so **the tongue is OUTVOTED, not
broken.** A disabled slider with a sentence beside it said so and it was read
past. The picture says it instead: the vowel's own point is drawn, your handle
is drawn, and **the dot on the line between them is where the tongue actually
goes.** At `artic: 0` that dot sits on top of the vowel and the line has no
length. The picture is the measurement.

**Two views, one store, and this page has already paid for getting that wrong
once** (`listening` and `volume` were two scales of one number and the record
went silent). Every value on the pad is an `<input type=range>` in the table
directly below and both write the same `voice.set` through the same
`writeKnob`; during a drag the twin slider's value and readout move too, so the
two cannot be seen disagreeing even for a frame. With the stylesheet off the
picture is a decorative `<svg>` and **the sliders are the page**; a screen
reader is given the sliders and never the picture, because an SVG you drag is
not a control and pretending it is one is worse than not drawing it.

**And the face was dead when Paul first reached for it.** *"I can't get to the
inside box with the vowels."* The record babbles at 0.4, which gates `tongue`
and `tongueD` — and a transparent grab rect went on declining the browser's
scroll over the largest object in the picture, so the tap did nothing AND the
swipe was eaten. The grab class is conditional on liveness now and the face
draws `is-off`. Measured: **a vertical drag inside that square scrolls the page
346 px where it moved 0**, and **every one of the other 46 controls in the
editor was hit-tested at its own centre at both widths and reaches.**

### The breath slider stopped being four-fifths travel

Paul: *"it's ALWAYS hissy — i think hiss is probably 5x too much for the range
of use."* It was the RANGE, and the measurement produced his number twice
without being asked to. The ceiling is one step past the balance
`to-engine.js` had already rejected in writing as *"a whisper's balance, not a
singer's"*: the breath at which air first stands **+3 dB over tone above
4 kHz**. That rule gives **0.2 of 1.0 on `tract_voice` and 0.12 of 0.6 on
`voice_lead` — one fifth both times, from one rule, on two different
modules.**

Two other suspects were measured and cleared. The DEFAULT is not hot: the
chant's 0.07 sits at **−8.6 dB air-over-tone**, the exact seat `to-engine.js`
chose. `FAM_EQ.vox` is real but worth **0.022 of breath — 2% of the old
slider** — and cannot cause a 5× complaint. **One module is left alone on
purpose:** the same rule puts `voice_choir`'s ceiling at 0.012, **below its own
derived 0.08**, and a slider whose top is under the number the record is
holding is the lie this page exists not to tell. Its range stands and the
comment says why.

### The score scrolls, and it renders whole

Paul asked for the whole band above the tune you are writing. It reads
`sectionRender(...).ev` — the stream the transport and the bounce are handed,
not `voicePhrase`, which exists only for LINE voices and would have drawn 2 of
8 staves on a precomposed record. **Where the score and the player's part below
it disagree, the score is the report.**

The misalignment Paul reported was measured to his own diagnosis: two four-bar
tiles of the same reggae came out **556.99 px and 588.20 px tall — 5.6%** —
each scaled individually into a fixed box, with 1.08 px of extra staff gap
compounding to 6.5 px by the seventh voice. It renders whole now, behind a
loader past a **100 ms** prediction — a threshold borrowed from
`test/motif-frozen.js` A7 rather than invented. Chant **132 ms**; Kingston,
152 bars and 7 voices, **1.7–2.8 s** for a paper **29,695 px wide holding
4,236 noteheads in one system.** Steady scroll, red notes, no playhead — his
design, and simpler than what it replaced. Same engrave cost as the two-bar
window it replaced (5 → 7 per playthrough, worst task 100 ms vs 105 ms), and
**the picture is never replaced**: the jumpiness was replacement, not cost.

### The producer was already ten

Paul: *"supposed to be able to say ten things not just one."* Measured before
a line was written: **nine sentences stacked, ten rows drawn**, each with its
own percentage and its own more / less / take it off, and `run` applying all
nine in order. `MAXNOTES` is 10, `addNote` appends, `notesTable` has drawn the
whole list since it was written. **Nothing capped it.** If it reads as one,
that is discoverability and not capability — worth knowing which, because the
fix is somewhere else entirely. It is question 5 below.

### The greying on the page is derived from real records now

`gates.json` decides which option is unreachable and what reason it prints,
and it is EXTRACTED. Until this week its anchor corpus was **the shipped chant
with its label swapped** — all 139 gave exactly 81 scopes and ONE live-sheet
set, where real precomposed documents give **120–365 scopes and 49 distinct
counts.** Fixing the corpus exposed two flaws in the FITTER that were worse
than the defect:

* **The corpus is bimodal**, so any column constant across the chant family
  separates it perfectly. Run 1 fitted `alphabet.harmony / cycle` = *"when
  time.bpm == 58"* — 58 bpm IS the chant — a rule that would have greyed the
  word `cycle` on 138 of 139 records and printed **a column name** as its
  reason. Every candidate now runs through THE PAGE'S OWN renderer
  (`Avail.whyOf`) on the rows it was fitted from and is thrown away if the
  refusal sentence still contains a raw column name. Not a blacklist: add a WHY
  row in `avail.js` and the same rule becomes fittable. Tempo is excluded
  outright and that one is **proved** — this file measures in STEP units, so
  eight records rewritten to a different bpm compile to a byte-identical event
  list, 8 of 8.
* **`MIN_EXPLAINED` had no twin on the live side.** `dev.line / at the octave`
  won a rule off a handful of scopes; asked again over 556 fresh ones it moves
  the events in **none** of them — 0/36 solo, 0/520 other — while `backwards`
  and `out` move 556/556.

**18 option rules changed.** The headline is `dev.line / at the fifth` — the
pad gate this slice exists for — which the old corpus had landed on *at the
fourth* and *down a degree* instead.

### `inv` is carried, and it moves the music

`marabi` calls its `inv: 2` *"the highest structural value on this page"* and
precompose used to drop it. Now: **28 of 212 bass events change pitch across 9
of its 10 sections, and 0 of 841 line events move** — correct, because `inv`
only ever moves `bassPc`. The chord-field census found four fields; `borrow`
is carried conditionally against the day an anchor uses it, and **`beats` is
deliberately NOT carried**, because a carried `beats` would itself be a number
in a shipped document that reaches nothing.

Two dead keys were **removed rather than wired**, and the argument is the
reason: `vowel: 1.4` cannot be honestly translated, because the singers' rows
are indexed a-e-i-o-u and the tract's i-e-a-o-u, so the same number is two
different sounds and 1.4 falls between different pairs in each. Guessing it
into a letter would have changed how the shipped record sounds on a coin-flip.

### The guest pool stopped being European

`GUEST_LEAN`'s `vox` row was `["gregorian","counterpoint","fugue","drone",
"vocal","vocal"]` — right when typed, when every choir in the catalog was
European, and wrong the moment `vox` ran from Aksum 540 to Leipzig 1725. Fixed
with **four laws read off the anchor, not a name-list**: the unaccompanied law
(derived, it finds exactly {gregorian, spem, organum, zema, mbube} — the five
whose entries already said so in prose); two era laws with `INSTR_YEAR`
EXTRACTED as the earliest year any dated anchor claims each id (church_organ
1725, harpsichord 1602, ahh_choir 540 — zema's own use setting that floor);
and two measured exemptions, because without the second the flat floor took
the guitar solo off Chicago 1952 and **Chuck Berry with no lead break is a
worse lie than the one being fixed.**

**254 out-of-period hires, in 157 of 417 records and 74 of 139 anchors → 0.**
`zema` went from CHURCH_ORGAN / HARPSICHORD on all three seeds to two
half-choirs and the cantor, no guest at all. A tighter rule was measured
(586 hires → 384) and **not** gated, because *"a guest is a foreign colour BY
CONSTRUCTION"* and gating tightness would delete the feature.

### The page stopped jumping, and the evidence that said otherwise was wrong

Paul: *"When I click tabs the page jumps around. It's endemic."* The first
report was a harness artefact — **`page.click()` scrolls its target into view
first**, CenterIfNeeded, and 2251.09 + 22 − 422 = 1851 exactly. Under the bad
harness was a real bug: `draw()` empties `#app` and rebuilds it, but abcjs
engraves on a **promise**, so when `draw()` returned every staff host was an
empty div and the page was short by one engraved measure per composed staff —
**~95 px per voice**, 190 px at four tabs, 764 px at ten. At five tabs the
correction exceeds `ANCHOR_MAX` (240), `restoreAnchor` declines, and the whole
286 px lands on the page. The shipped chant had **eleven pixels of margin**.

The fix is at the source — `staffBox` remembers what each measure engraved to
and `staffRoom()` reserves it as `min-height` **at creation**, before abcjs is
asked for anything. Proof it is a fix and not a fight: **with `scrollBy`
stubbed out entirely, so `restoreAnchor` cannot act at all, every tab moves
0 px.** It was +190. Matrix after: 7 strips × 5 scroll positions × 2 widths,
mouse and touch, plus WebKit, plus a browser with anchoring disabled, plus the
8-voice record at 36 real taps — **worst |jump| 0 px.**

The engine readout no longer shoves the page either: `#engine { min-block-size:
2lh }`, doubled from the recipe because the same report measured the case one
line does not cover (a dropout sentence wraps to two lines at 390 px and drops
the page another 18 px with nobody touching anything).

### The globe's labels travel

They were positioned in absolute viewBox coordinates by the anti-collision
pass, which is guarded by `if (labelsStale)` and deliberately never runs inside
a moving frame — so the mark was re-transformed every frame and the name was
not. **Pairing drift mid-drag 71.0 px → 0.0 px at 390, 124.5 → 0.0 at 1280;
far-side labels 1 → 0; a fly-to carried a mark 367 px with a spread of 0.00 px
over 41 samples.** A pinch now tracks, where before it moved nothing at all
because the pinch handler never set the flag.

### The master chain, and the tone that reaches the sound

Paul: *"Almost everything is once again loud and distorted and there's no way
to bring it down."* Three suspects were named and **all three measured OFF and
exonerated** (whole desk tone withheld: 0.32 dB quieter; `FAM_EQ` alone: 0.33;
reverb return shut: 0.11; precompose desk removed: 0.00). It was a threshold
crossed, not a line changed. Three fixes, all in the parent:

* **The fader was the last node.** Swept on Tampa 1990 it moved the level at
  every position and **never once moved the crest** — 8.2 / 8.2 / 8.1 / 8.1 /
  7.7 dB. That is "no way to bring it down", literally. It sits at the master
  bus INPUT now and the crest recovers as you go down: **7.76 / 9.37 / 10.14.**
* **The +8.3 dB make-up was a constant written for material that no longer
  exists.** A precomposed band record arrives at −9.4 dBFS, so the brickwall
  sat in permanent gain reduction. It is a target riding toward −14 dBFS now,
  **capped at the old constant** so nothing comes out louder than it did, and
  read **pre-fader** so turning down can never make it push back up.
* **The ceiling was not the last thing the signal touched.** Two RBJ lowpasses
  parked at 20 kHz sat AFTER the limiter, at 0.907× Nyquist where the
  bilinear-warped biquad has a passband peak. **227 clipped samples across
  eight records → 0.** The quiet ones are unchanged (chant −14.63 → −14.66);
  the hot ones got their transients back (toto 3.2 dB quieter, +2.4 dB crest).

And the desk EQ reaches a MODELLED voice, because the strip is a stage the
renderer owns now: pushing the cantor's board EQ to `lo −6 / hi +6` moves the
output **−5.7 dB at 50 Hz and +4.7 dB at 15 kHz with 250 Hz–2 kHz inside
±0.3 dB**; the same gesture that morning moved −0.8 / −1.2 dB, noise in the
wrong direction. `EQ.md` is the account, including the catalog-wide
consequence: **222 sampled chair-boxes were already carrying a non-flat
`lo`/`mid`/`hi` that did nothing, and now they do something** (about 1.5 dB).
`FAM_EQ`'s rows are centred to zero mean dB in code — eight of twelve were net
boosts as typed, harmless while the number was computed and thrown away, wrong
the day it became a real stage.

### The ping-pong trap was sprung before it caught anything

`EQ.md` §7 flagged it: both renderers route a voice into the buffered path when
it has an insert chip **or a board tone** — after `FAM_EQ`, very nearly every
voice — and that tail did not write `buses.pp`, while the direct branch did.
`desk-gate` G8b stayed green through the whole defect because its fixture feeds
`curPP: 0`. **A bus that is never asked for is a bus that is never missed.**
`test/pp-send.test.js` turns the throw ON and asserts the buffered path's pp
bus is identical sample-for-sample to the direct branch's, that the strip
really engaged (so it cannot pass vacuously), and that the LIVE and PRESS
renderers agree. **10 checks, green.**

### The board split, and the buses are four

One table was **68.1% empty body cells**, because a channel's rows and a bus's
rows are almost disjoint sets. Two tables now: **channels 0.0% empty, the rack
6.3%.** There are four buses; bus 3 and bus 4 are **groups**, so their sends
are summed into whichever bus they are aimed at, and `buses.<bus>.to` is that
aim — `desk-gate` G14 measures a moved send arriving somewhere new
(15.16/0 → 13.03/8.73). The one bus-to-bus send that reaches the engine is the
master's `space` (`mrev` in `fx_bus.dsp:221`), and the board says so instead of
drawing a second control for it. **Every route the board offers either reaches
the engine or draws disabled with its reason printed.** `desk-gate` passes
**123 checks.**

### The design system is seven kinds, one look each

Paul: *"Create a simple design system and use plain HTML buttons where
appropriate but bring more consistency."* Audited on the RENDERED page at 1280
and 390, every tab clicked, computed styles read back: **292 interactive
elements**, and the number of DISTINCT COMPUTED LOOKS each kind had. Four of
those looks were accidents and each is named in `nu.css` — a `<button>` inside
a `<th>` came out **bold**, because `button { font: inherit }` inherits the
header's weight, so eight of twenty-three tabs were a different button from the
other fifteen for no reason anybody chose. Afterwards: **an action is 1 look, a
tab is 1 look**, and every remaining second look is a STATE the browser draws.

Seven kinds and that is all the page needs — an action, a tab, a settled
choice, an open choice, a switch, a quantity, a step — **plus one thing that is
not a control at all**: `<a href>`, which until 2026-08-26 the page had none
of, and which is the only element that LEAVES the page and therefore the only
one that gets an underline. Four states any kind may wear: `.is-on`,
`.is-off`, `.is-quiet`, and `<mark>`/`.is-now`, which is reserved for the
sounding step and the tab you are on and **may not be borrowed.**

### A colour per section, and it is arithmetic

*"Give each section a slightly different color."* Nobody types a colour: a
section's `--sec` is its ordinal and the hue is **`--sec × 137.5deg`, the
golden angle**, written modulo twelve so a page of thirteen sections does not
run out. **"Slightly" is the whole specification** and `--wash` states it: 4%
of a fully saturated hue mixed into `Canvas` in oklab. Measured on the rendered
page, light: paper moves from `#ffffff` to between `#fbf5f7` and `#f2f9fb`, and
CanvasText on the darkest of them is **19.8:1** where WCAG AAA wants 7:1.

It moves `--paper` and that is the whole mechanism, so every sticky heading,
scroll shadow and sticky first column follows with no second rule.
`--rule`/`--zebra` are mixed against `Canvas` and not `--paper`, so **the wash
moves the ground and never the ink**. It is not a state and may not read as
one: measured, the largest colour distance between any two sections' grounds is
smaller than the distance from any ground to `<mark>`. Under `forced-colors`
and `prefers-contrast: more` `--wash` goes to 0%. With the stylesheet off there
is no colour and nothing is lost.

### A take is a seed, and the slider used to move nothing

Paul: *"I can't seem to change seed and do a different take."* Measured:
`performance.take` was in every document, `ui/eight.js` drew a slider for it,
`ui/atlas.js` printed it, and **no compiler read it** — every record this box
has ever made was take one. It is spent now in `toGenre` on the kernel's own
dice and the pipe operators' seeds. Over 60 anchors: **55 render a different
score at take 5, all 60 are reproducible**, and the only keys a take moves in a
compiled genre are `kitSeed` and `pipes` — **no decision is downstream of it**,
which is what makes "the same song, played again" true by construction.

### Eight tempo icons, under Time where they belong

Paul: *"The rhythm icon adjustments never happened."* The fourteen that existed
were seven PITCH and seven RHYTHM operators and **not one of them moves the
clock**; every tempo fact this box has is a song fact. So eight tempo icons
went under **1 · Time**, between the two facts they move: four move the CLOCK,
four move the READING, and they are drawn differently because closer ticks and
a nearer bar line are two different pictures. **No icon is drawn for an
operation the box cannot perform**, and one that cannot move from where the
record is standing greys with its reason printed (*"twice 120 is 240, and 220
is as fast as this box counts"*).

The motif transform icons went the other way and it is a **reversal on the
record**: they were drawn contours for two days, tested on a reader, and
failed — *"the record's own"* read as *"default"*. They are unicode arrows now.

### One word for the empty detent, and a bus is "called" something

Paul: *"'as it stands' and 'nothing set' are too much. get rid of them — just
use 'default' for 'nothing set'."* Every empty detent in the app says
**default** now, **including the two that hid in `<optgroup>` and `<option>`
LABEL attributes** — supersaw's wave, the DX7 cartridge, the singers — which an
`innerText` audit cannot see and the check only caught **by reading
`outerHTML`.** That is the artifact law again, one layer finer: the rendered
text is not the whole artifact.

And the row that said *"name"*: Paul, *"'name' is a very confusing row because
the 'name' seems to be reverb types."* It did. `BUSNAMES` shared four words —
plate, hall, chamber, spring — with the reverb-algorithm knob **one row down**,
and *"room"* meant three different things on one board. The row is **`called`**
now, its vocabulary is twelve JOB words (ambience, depth, bloom, throw, lift,
smash, parallel, double, stack, blend, wash, sheen) that **collide with no
effect table**, and bus 1's algorithm knob says **"reverb type"**. A record
that saved a retired name falls back to the row's own label rather than
crashing. Verified on the rendered DOM: **zero hits for either retired string
across 18 page states at two widths**, and the two option lists intersect only
at *"default"*.

### The motif has a play button, and a tab is for looking

Paul could already sound a motif — tapping its tab did it — **but an
affordance nobody can see is not a control**, and the only visible thing on the
block said *"loop"*, so the plain single pass had no door at all. One button
now cycles **off → once → loop → off**, kept by NAME so it survives a redraw.
**The word on the button is the NEXT TAP, not the current state** (`▶ play` →
`↻ loop` → `■ stop`): a single pass ends by itself, and a button that named the
state would have to be rewritten by the sound's own callback — a write into a
control, which the frozen-DOM law forbids. The live sentence beside it says
what is happening. The tab-tap is retired with it, which also closes the
standing complaint that tapping the open tab restarted the sound with no way to
stop it.

### And the rest of the surface, still true

* **Precompose.** 199 anchors × 3 seeds, no throw and no silent section. Every
  record carries `sound.buses` (199/199); 27 carry `sound.fx`; **803 of 1,416
  voices carry a `desk`**, and the 613 that do not are absent-is-today doing
  its job. `time.groove` is six words, not one: backbeat 83 · none 35 · push 31
  · funk 29 · laidback 12 · dub 9 (seed 1). **All 175 bass voices carry no
  `instrument`** and that is correct — a `kind:"bass"` voice is written by the
  kernel's own bass writer.
* **The atlas.** 199 anchors = 193 placed + 6 excluded, **85 stops 540..2023,
  109 places, 0 orphans, 0 empty stops**, 20 `ERAS` rows and "now" present
  *because the catalog reaches 2023*, derived rather than typed, so it cannot
  become the same lie in 2031. `atlas.gate` passes all 34 checks.
* **The shell.** Every assertion measured off the rendered page at 320 / 375 /
  430 / 820 with a drummer hired first: no sideways scroll · no `button`,
  `select` or `input[type=number]` under 44 px · every checkbox and radio with
  a 24 px target on both axes · no pane a two-axis scroller · no table
  overflowing its box · exactly one pinned axis heading and it is the axis you
  are inside · a sticky first column surviving a sideways scroll.
* **Nudges.** 24 checks. `env:"arch"` moves the rendered velocities (a flat
  64-event stream comes out `3 4 4 5 5 5 5 4`); with no drummer all seven
  drum-writing edges are disabled and nothing else is.
* **The producer's own gate.** 26 node checks over every reachable stack,
  28 browser checks. `more` pushes, `less` puts it back exactly, *"take it
  off"* restores the document byte-identical, and a `less the cantor` note
  lands in the mix-offset layer rather than in the Sound axis.
* **Ableton export.** The `.als` round-trips against the SONG, conforms to the
  donor, and the sample audit finds no authored absolute paths.
  `tomHi`/`tom`/`tomLo` export as **50 / 47 / 43**, not three copies of 47.
  Whether a set **opens** only Live can answer — question 7 below.
* **The motif page is frozen while it plays.** The editable half of a motif is
  **byte-identical across two real section boundaries — 46,685 characters,
  measured today** — the same DOM node under a finger, the window moved 0 px,
  the first fieldset at 541 px before and after, the band axis at 2,705 px
  before and after. Zero abcjs redraws at a boundary, and **no long task ≥100 ms
  after the engine started** (longest 74 ms at 390, 0 ms at 1400). The one long
  task the gate does see is 112 ms at +0.1 s, **the engine starting — your
  press, not the clock** — and the gate names it rather than asserting it away.

---

## THE GATES, AS THEY ACTUALLY RAN TODAY

**TWO FULL `--complete` RUNS, AND THE SECOND ONE IS THE ONE TO TRUST.** The
first found the four red gates above; the second was taken after they were
repaired, on a settled tree, and is the reading of the box as it stands.

### Run 1 — 21:27 → 21:54, on `9b76f77`

4 cores, 8 GB. **Load at the start 0.37 0.28 0.50 · load at the end 2.54 2.77
2.63.** The runner prints the load on every run for exactly this reason: a wall
clock taken on a contended box is not this suite's cost.

```
pass  document        0.6s  22 passed, 0 failed
pass  pp-send         0.4s  10 checks pass, 0 fail
pass  atlas-data      0.8s  PASSED all 34 checks
pass  ableton         2.6s  gate 3 — no new sample references (0, the donor's
                            own) · no authored absolute paths
pass  wiki           12.6s  191 links and 2 misses re-derived from
                            wikipedia_en_all_maxi_2026-02, identical to
                            what ships
pass  desk           18.9s  all 123 checks pass
pass  precompose     43.7s  43 passed, 0 failed
pass  knobs          98.8s  ALL PASS  94 checks
pass  producer      608.8s  26 passed, 0 failed · G3 COMPLETE — every sentence
                            at every rung, all 200 random stacks
pass  gates         816.9s  OK  the shipped table is what the box says
pass  nudges         11.4s  ALL PASS (24 checks)
pass  producer-ui    10.9s  ALL PASS (28 checks)
pass  sheets-tier     5.6s  ALL PASS (29 checks)   the harness page
pass  shell          25.6s  PASS — every shell assertion holds (1 skipped)
FAIL  sheets         14.5s  2 of 28   ["master.fx"] — an undeclared sheet
FAIL  selects        20.0s  1 of 52   the multiselect that moved to the board
FAIL  atlas         165.6s  6 of 103  four title compares, two catalog growths
  — and one alone, because everything it asserts is about time —
FAIL  motif-frozen  120.5s  4 failed  a layout Paul reversed on 2026-08-25

14 pass · 4 fail · 0 skip
COMPLETE · 1589.9s wall (serial would have been 1978.1s — 1.2x)
```

**AND ONE CAVEAT ON THE TREE THAT RUN MEASURES, which is the same caveat the
2026-08-25 edition had to write.** A commit landed at **21:36**, twenty-two
minutes before the last gate exited: `0bc7114`, the motif play button. Two more
landed at **22:05** (`b68066d`, `2c0454d`). So run 1 is a true reading of what
was on disk when each gate ran, and **not** of any one tree. That is why there
is a run 2.

### Run 2 — 22:12 → 22:35, on `2c0454d`, the settled tree — **GREEN**

Same box, same flag, nothing skipped. **Load at the start 0.97 1.51 2.47 · load
at the end 1.51 1.89 2.26.** This is the reading to trust.

```
pass  document        0.3s  22 passed, 0 failed
pass  pp-send         0.3s  10 checks pass, 0 fail
pass  atlas-data      0.4s  PASSED all 34 checks
pass  ableton         2.1s  gate 3 — no new sample references (0, the donor's
                            own) · no authored absolute paths
pass  wiki            3.2s  191 links and 2 misses re-derived from the ZIM,
                            identical to what ships
pass  sheets-tier     4.4s  ALL PASS (29 checks)   the harness page
pass  producer-ui     9.3s  ALL PASS (28 checks)
pass  nudges         10.4s  ALL PASS (24 checks)
pass  sheets         11.8s  ALL PASS (28 checks)
pass  selects        15.3s  ALL PASS
pass  desk           15.6s  all 123 checks pass
pass  shell          22.2s  PASS — every shell assertion holds (1 skipped)
pass  precompose     44.7s  43 passed, 0 failed
pass  knobs          77.7s  ALL PASS  94 checks
pass  atlas         147.7s  ALL PASS (98 checks)
pass  producer      509.7s  26 passed, 0 failed · G3 COMPLETE — every sentence
                            at every rung, all 200 random stacks
pass  gates         660.3s  OK  the shipped table is what the box says
  — and one alone, because everything it asserts is about time —
pass  motif-frozen  120.3s  all checks pass

18 pass · 0 fail · 0 skip
COMPLETE · 1335.1s wall (serial would have been 1655.9s — 1.2x)
```

**Three numbers are worth reading twice.**

`gates` re-derives the option table in **660–817 s** (817 in run 1, 660 in
run 2 — same work, a quieter box) where the 2026-08-25 file recorded 173.3 s.
That is not a regression: it is the price of fixing the corpus. The table used
to be derived from **one chant wearing 139 labels**; it is now derived from
**199 real precomposed documents**, and the derivation sits behind a content
hash so the FAST path skips it when its inputs are byte-identical.

`producer` costs **510–609 s** against 291 s on the FAST path, which is the
`--complete` flag doing its job: *"G3 COMPLETE — every sentence at every rung,
all 200 random stacks"* instead of a rotating rung and a seeded sample of 20.
**FAST is not the deploy gate and says so in its own output.**

`atlas` reports **98 checks** where the failing run reported 103, and that is
the repair rather than a loss: the four exact-title compares collapse into one
reading through a single helper (`window.__nuName()`, installed with
`addInitScript` so it survives the file's six reloads), and one new assertion
was ADDED — *"there is a stop above 1984 that Tokyo does not hold (1995)"* —
which is the derivation that makes the Tokyo check ungrowable-out-of. **The
printed totals are not a coverage measure and should not be read as one:**
several assertions are emitted once per thing found, so a run that fails early
finds different things.

The soak is **not** in the runner and was **not** run: *"Don't do the soak."*

---

## STILL DEFERRED, REBUILT FROM SCRATCH

Every item in `PROGRAM.md` §4 (fifteen), every item on the 2026-08-25
`STATE.md`'s own list (twenty-six), and all nine sections of the after-voice
queue were walked and re-measured today. What follows is what survived. The
bracketed id says where the item came from, so nothing is renamed out of
sight.

### Closed this week, with what closed it

* **[§4·11 / STATE 20] The `pp` send vanished in the buffered tail.** Both
  renderers write it now and `test/pp-send.test.js` holds the two paths
  identical, sample for sample, with the throw ON.
* **[STATE 15] The anchor corpus was one record.** `gates-extract` measures 199
  real precomposed documents. 18 option rules changed. The derivation costs
  **660–817 s** now, against 173.3 s when it was one chant wearing 139 labels —
  that is the price of the fix and it is behind a content hash.
* **[STATE 16] `inv` dropped on the way into a document.** Carried; 28 of 212
  bass events move on `marabi`.
* **[STATE 17] The `vox` guest pool was European.** Four derived laws; 254
  out-of-period hires → 0.
* **[after-voice §8] Industrial rock sounded like Fela.** Not the casting and
  not the drive wiring — **precedence**: precompose named an instrument for
  every chair, and a chair's own instrument outranks the record's signature
  synth. Fixed at the seam. `industrialrock` gets `lead_fuzz` at drive 0.85
  verbatim, and 15 of 15 anchors that declare a signature synth now seat it.
* **[MOTIF 2] `<p id="engine">` shoved the page down.** `min-block-size: 2lh`,
  with the measurement in `nu.css` for why one line was not enough.
* **[MOTIF 1 / the endemic jump] Tabs jumped.** Fixed at the source; 0 px
  across a 7 × 5 × 2 matrix plus touch, WebKit, and anchoring disabled.
* **[GLOBE 1, 2] The pinch anchor and the diagonal drag lock.** Fixed in the
  2026-08-25 round and the labels now travel with their marks.
* **[AFRICA 5] `latinpop` descended from `afrobeat`** because Cuba and Colombia
  were not in the catalog. They are now: `latinpop` reads
  `{salsa .35, cumbia .2, son .1, rock .2, bossa .15}`.
* **[after-voice §9] The motif audition had no stop.** `0bc7114`: the tab-tap is
  retired and the block's own button cycles **off → once → loop → off**, so
  silence has a gesture. *"A tab is for looking."*
* **[THIS FILE'S OWN FOUR RED GATES] Repaired and committed** as `2c0454d`,
  *"the gates catch up with the page they measure"* — all four green.
* **[PROGRAM §5, Paul's ears 3] `fx` back on a track.** ANSWERED, and the
  answer was no. The ask read: *"the sends are wired to real returns now, so a
  chip is only for what must be IN the path. Do you accept the reversal?"* Paul,
  2026-08-26: *"Don't let me add effects to instruments. That's bus and board
  stuff. But let me have up to four buses and a way to direct them to each
  other."* The chips came off every instrument and lived on the board as
  `master.fx`; the measurement that made the losing argument — an insert costs a
  MULTIPLE, a bus costs a CONSTANT — is now the reason there is a fourth bus.
  **AND IT REVERSED ONCE MORE, 2026-08-27, TWICE IN ONE DAY AND BOTH TIMES BY
  PAUL.** First: *"I think we need to do what everyone else does with effects.
  Add per voice effects, up to three. Each has a wet dry mix and its own
  settings."* — the chip went back on the instrument, with slot knobs. Then, of
  the record-wide control it had been moved to: *"We can get rid of Character
  right? We don't really use it any more do we?"* Measured before it went: the
  HAND did not use it (it was the page's only `<select multiple>`), the
  COMPILER did — 27 of 199 anchors wrote a `sound.fx`, and `audio/desk.js`
  folded it into the insert chain of every seated voice, costing neoclassical
  2.23 dB of RMS and ambient 1.96 dB of peak on the rendered artifact. So it
  was dealt rather than deleted: `precompose.js deskThe` writes the same chips
  on every chair, `document.js normalize` folds an already-saved `sound.fx` the
  same way at the door, and the rendered chain is identical. **Nothing left to
  decide here.**

### Open, re-measured today

1. **[§4·1] F1 — the two nginx headers.** Checked at 21:39 today by `curl`:
   `www.ftrain.com` serves the page with **neither COOP nor COEP**, so
   `SharedArrayBuffer` is undefined and the page demotes to a different engine
   with no conceal and no counters. `test.stellate.app` **is** isolated
   (`cross-origin-opener-policy: same-origin`,
   `cross-origin-embedder-policy: require-corp`). An ops line outside the repo.
2. **[§4·2] F4 — the per-note channel strip.** `engine/faust/voices/sampler.js`
   still builds a whole strip PER NOTE ("CRITICAL — window parity: the strip
   runs PER NOTE", :61). Untouched, deliberately: it is the one item that can
   change how a record sounds and `mixPCM` must not move. Behind ears.
3. **[§4·4] Ableton P1–P4.** P0 needs nothing. P1 and locators need **Ask #1**
   (one 30-second Live save with an 8-note clip in a slot, a copy in the
   Arrangement, one locator); P2 needs **Ask #2**. Gate 2 is written to REFUSE
   `<Locator>` because the donor has none, so the failure is the trigger.
4. **[§4·6] Augmentation and diminution as Development words.** Implemented in
   `ideas-kit.js` over a RENDERED phrase, therefore unnameable in `WORDS`. **No
   kernel operator maps step *i* to step *2i*.** Do not fake it.
5. **~~[§4·7] `bassGrid` has no document slot.~~ CLOSED 2026-09-01, AND THE
   REASON WRITTEN HERE WAS THE WRONG ONE.** The item read: *"Re-measured: 18
   anchors declare one and 0 of 199 precomposed records carry it. Same shape as
   `inv` was."* The count is now **22 of 387**, and the document slot was never
   the mechanism: `document.js toGenre` opens with `...GENRES[doc.basis]`, so
   every field an anchor declares reaches the kernel whether or not any
   precomposed record repeats it. `g.bassGrid` was arriving at the OBJECT and
   dying at the EXPRESSION — `kernel.js` chose the bass grid in a four-way
   chain and ranked it LAST, under `STYLEGRID[g.bassStyle]` and under the
   MELODY's accent vector `subj.acc`. Measured before the fix: **13 of the 22
   were outranked by their own `bassStyle: "eighths"` and 9 by `subj.acc`**, and
   the declared rhythm survived on exactly three — `drone`, `waltz`, `musette` —
   and only because each writes a lone downbeat, which is what the branch above
   it happened to produce anyway. So `bodiddley` wrote the Bo Diddley clave and
   played straight eighths; `reggae` wrote the off-beat and played straight
   eighths; `tango` wrote the habanera and played straight eighths. **Nineteen
   bass rhythms typed into the catalog reached no note.** Fixed as a
   PRECEDENCE and not a table — nothing invented, the 22 that exist are simply
   read — in the order kernel.js's own comment already argued for: figure, then
   grid, then the density word, then the melody's accents. `askable.js` calls
   `bassGrid` *"superseded by `bassFig`"*; measured the same day, **0 of 387
   anchors declare a `bassFig`**, so the successor has no rows and the
   supersession was a promise the demotion had already been paid for.
   `test/bass-grid.test.js` holds it at the NOTES (22 of 22 play their declared
   grid; all 365 anchors without one byte-identical), and fails 25 of 31 on the
   old order. **BEHIND EARS:** nineteen records' bass moves, by design.
6. **~~[§4·8] `orn` — THE TABLE NOW EXISTS AND PRECOMPOSE DROPS IT.~~ WITHDRAWN
   2026-09-01: IT WAS NEVER DROPPED, AND THIS ENTRY MEASURED THE WRONG LAYER.**
   The item read: *"`genres.js ORNAMENT` is 58 anchors with reasons … and 0 of
   199 precomposed records carry `performance.orn`. This is `inv` again, one
   layer up, and it is now the highest-value item on this list."* Both halves of
   the measurement are still true — the table is **40 rows over 115 genres**
   today, and **0 of 387 precomposed records carry `performance.orn`** — and the
   conclusion drawn from them is false. `document.js toGenre` opens with
   `...GENRES[doc.basis]`, so `blues`'s `{pass: 0.3, grace: 0.45}` is on the
   object the kernel is handed whether the document repeats it or not.
   Measured at the RENDER: setting `performance.orn` to the genre's own policy
   moves the section-0 events of **0 of 115** anchors, because they were already
   moving — `blues` section 0 renders **8 grace-marked notes** with the field
   absent. `performance.orn` is the HAND's slot (a policy a document may state
   that its basis does not), which is exactly what `document.js:292`'s own
   comment says it is.

   **THE LESSON, AND IT COST TWO ENTRIES ON THIS LIST.** "N anchors declare it
   and 0 records carry it" is not a measurement of arrival — it is a
   measurement of REPETITION, and under a basis spread the two are unrelated.
   Every future declared-but-never-arriving claim on this list must be taken at
   the rendered events, the way `test/bass-grid.test.js` takes item 5's.
7. **[§4·9] The theme composer and the solo ladder.** `ideas-kit.js` is a second
   material model beside the hand-written grid; D5 uses it to WRITE cells,
   wiring it as an editable surface is a slice of its own.
8. **[§4·10] `fitReg`.** Re-checked today: `band-kit.js:1379` defines it,
   `:3319` is its only caller, and **precompose is not that caller** — it writes
   `reg` raw off the IDIOM table. Measured 19% → 7% of seats out of compass.
   Ten lines against `instruments.js RANGES`.
9. **[§4·11] Master `width`/`tilt`/`ceiling` reach no sound.** They round-trip
   and draw `disabled` saying so. Bus 2's return is a compiled slider the parent
   nails to a literal. Both are parent edits with parity gates behind them.
10. **[§4·12] A per-section desk is not expressible**, and after the EQ round a
    per-section EQ is not either: a voice's tone is one decision for the whole
    record. Right for the Sound axis today; wrong the first time somebody wants
    a chorus louder than a verse.
11. **[§4·13] `cast.part` collapses to line/pad.** `ui/eight.js` hands the
    kernel `realize` and never `part`, so a voice the document calls a `counter`
    is ADDRESSED `line2`. The board prints the address under the name so the two
    are never confused, which is honest, not fixed. Fixing the name **moves the
    music** (`kernel.js:1387`).
12. **[§4·14] Two catalogs of place and era.** G5b passes with `ERAS` a proper
    superset of band-kit's `DECADES`, but `band-kit.js:887` still says **"Rio"**
    where `genres.js` says **"Rio de Janeiro"**. The merge is its own job.
13. **[§4·15] F7 — the two open WAV-route audit items.** They only matter if F1
    slips; that is the route an un-isolated host forces.
14. **[STATE 18] Parent-after-child pairs in the genealogy — 19 → 21**, which
    is not a regression: the catalog grew 43% under them and the RATE fell,
    19 of 139 to 21 of 199. Re-measured today by parsing each anchor's own
    label year: `spem 1570 ← counterpoint 1725`,
    `gospel 1932 ← blues 1952` (w 0.75), `swing 1938 ← blues 1952`,
    `jazz 1945 ← blues 1952`, `countrypop 1945 ← blues 1952`,
    `bluegrass 1946 ← blues 1952`, `pavane 1551 ← spem 1570`,
    `yuletide 1942 ← crooner 1953`, `beatles 1962 ← motown 1965`,
    `musichallrock 1966 ← rock 1969`, `crooner 1953 ← doowop 1955`,
    `motorik 1974 ← kraftwerk 1977`, `roboticpop 1978 ← synthpop 1981`,
    `yachtrock 1979 ← toto 1982`, `analogsynthpop 1980 ← synthpop 1981`,
    `clubpop 1983 ← house 1986`, `gothicpop 1987 ← shoegaze 1991`,
    `industrialrock 1989 ← deathmetal 1990`,
    `industrialbreaks 1989 ← dnb 1994`,
    `industrialmetal 1988 ← deathmetal 1990`, `screamo 1994 ← emo 1999`.
    **Five of the twenty-one are one anchor** — `blues`, Chicago 1952, standing
    in for a music forty years older. Some are defensible as proxies for an
    unbuilt ancestor; **none says so.** One sweep with a rule, not another
    anchor at a time.
15. **[STATE 19] `rai` measures 95% invention, `ethiojazz` 69%,
    `mahraganat` 66%.** Honest declarations of a hole — the true ancestors are
    not in the catalog — but a reader of the published residues will read them
    as originality. They need a word for *"unexplained because absent"*.
16. **[STATE 21] No drum-kit spectrum on the tape.** `EQ.md` §7 says it plainly:
    the kit is proved by reading the numbers and by the gate's isolated audio,
    not by a measured spectrum. A twenty-minute job now that the map has
    settled, and the one measurement that report is missing.
17. **[STATE 22] No bus EQ and no master EQ.** The three knobs are per channel.
    Nothing on the reverb return, the delay return, or the master.
18. **[STATE 23] `PERCBANK`'s 24 real percussion hits are unread by nukernel** —
    grepped, zero references — so maracas ride the hat lane and congas ride the
    toms. `AFRICA.md` calls this *"the single highest-value piece of work behind
    this round, and it is not African-specific"*, and the world round made it
    larger: son, choro, mento, kroncong and rebetiko all want it.
19. **[STATE 24] The twelve-pulse metre does not exist.** `kernel.js:349` defines
    `six: {steps: 12}` but every phrase, cell and kit vector is written on
    **sixteen**, so a 12-slot bell under a 16-step seed **phases** rather than
    becoming 12/8. Ewe agbadza, the mbira's 48-pulse cycle, gnawa and mbalax are
    unsayable; **chimurenga (Harare 1977) is metre-blocked and nothing else**,
    and is the first thing to build the day a twelve-step seed exists. This is
    `WORLD.md`'s Tier 2 wall and it now blocks a longer list than it did.
20. **[STATE 25 / MOTIF 1] Nudge a degree slider and the page jumps 114 px**,
    with the grid snapping back to step 1 — and it does the same with the record
    STOPPED, so it is the page rebuilding because you touched it, not the clock.
    The tab jump is fixed; **this one is not, and it was not re-measured today**
    because the staff-reserve fix landed on a different path.
21. **[STATE 26 / GLOBE 3–6] The globe's cosmetic three, unrechecked.** At the
    deepest zoom the earth is an outline rather than land and sea (an open run
    cannot be filled); the page may still open zoomed to 57° on a wide desktop;
    the slider is the browser's blue.
22. **[after-voice §7] Techno's main voice eats the song.** Paul: *"technos main
    voice is this very fuzzy bass synth that sounds like distant thunder … It
    just eats the song."* **Untouched, and the §8 fix does not cover it** —
    `techno` declares no `synth` block, so the precedence bug that silenced
    fifteen anchors was never its mechanism. Its data still reads
    `instr: [fifth_sawtooth_wave, polysynth]`, `tone: {cut: 1400, q: 4}`, which
    is a lead in the cellar with a resonant peak where the kick and bass need
    room. The queue's order of honesty stands: **the wrong seat, then the
    register (`fitReg`'s first real customer), then the filter, and only then
    the desk.** Do not simply turn it down — attenuating a voice in the wrong
    register makes a quiet record that is still muddy.
23. **[after-voice §5] "Can we adjust gender pitch like Pink Trombone does" —
    NO, AND THE REASON IS IN THE DSP.** What reads as gender there is the LENGTH
    OF THE TUBE: shorten it and every formant rises. `tract_voice.dsp` has no
    tract-length parameter — `tongueL` is the TONGUE's length, not the throat's,
    and `ui/eight.js:5477` says so at the spoke so it can never be mistaken for
    one. Adding it is a `.dsp` edit plus a recompile, which this box can do
    offline (`engine/faust/build/build.js` did it for the EQ round), but it
    **CHANGES A SHIPPED VOICE'S SOUND**, so it is its own round with its own
    before/after spectra and not a rider on a UI change.
24. **[VOICE §13] `plan.js` hands the parent `seed: 1`**, so the take does not
    reach the mouth's own syllable driver or the house FX hash. The voice's
    `seed` row is the per-voice answer; the song-level one is a one-line change
    in a file the voice round did not own.
25. **[VOICE §11] Six voice parameters have never been judged by ear** —
    `vibrato`, `vibRate`, `vibRise`, `glide`, `spread`, `drift`. The gate's
    assertion for them is REACH, not audibility. The tract's sustain caveat is
    printed on the page rather than resolved.
26. **[WORLD] The Pacific row is coastline-blocked.** Four written, castable,
    12-TET anchors are withdrawn because `atlas-land.js` bakes physical land
    only. One re-bake unblocks them; the gate that catches a city in the sea is
    the same gate that refuses to let them in.
27. **[NEW 2026-09-01] THE ARRIVAL SWEEP, and the shortlist it printed.** Item
    5 was found by hand and items 5 and 6 between them proved that counting
    which records REPEAT a field says nothing about whether it arrives. So the
    question was asked of every field at once: for each of the ~54 things a
    genre may declare, delete it from the object `document.js toGenre` hands
    the kernel and re-render — `K.render`, `K.bass`, `K.drums` — on **every one
    of the 387 anchors that declares it**. A field that changes no note on any
    anchor is not reaching the music. The run is
    `test/_arrival-sweep.cjs` — a PROBE and not a gate, which is what this
    directory's `_` prefix means — ~6 minutes, pure node, and it re-derives `bassGrid`'s 19-of-22 from scratch, which is the
    calibration that makes the rest of the column worth reading.

    **THE SWEEP IS A SCREEN, NOT A VERDICT**, and it must be read with its
    three limits in hand: it renders **section 0 only**, at **seed 1**, and it
    reads **NOTES only**. So `bpm`, `tone`, `instr`, `synth`, `mix`, `fx`,
    `words`, `plan`, `realize`, `family`, `near`, `wants` all print 0 and are
    all innocent — they are sound and casting, and this instrument cannot hear
    them. `intro` (65) and `instrumental` (53) print 0 for the section-0 limit:
    the kernel's `intro()`/`outro()` run at section EDGES.

    What is left after those are set aside is the shortlist, and every line of
    it is a claim to be re-measured one at a time before anything is touched:

    | field | declares | moves a note on | the suspicion |
    |---|---|---|---|
    | `seqArp` | 13 | **0** | an arpeggiator setting that reached nothing at section 0 |
    | `arpAlways` | 1 | **0** | same family, one anchor |
    | `progFamily` | 2 | **0** | two anchors, no effect |
    | `paces` | 3 | **0** | |
    | `drops` | 1 | **0** | |
    | `incMode` / `incClamp` | 9 / 30 | **0** | already confessed: `askable.js` says "nothing in this box writes `inc`" |
    | `maxHold` | 343 | 2 | declared by nearly everything, bites almost nowhere |
    | `roots` | 248 | 15 | |
    | `ghost` | 4 | 2 | |
    | `artic` | 349 | 81 | |
    | `phrase` | 359 | 92 | |
    | `orn` | 115 | 92 | **healthy** — item 6's proof, and the calibration for this column's high end |

    `maxHold` is the one to take first: 343 anchors declare it and two of them
    can tell. That is either a field doing nothing or a field doing something
    only under conditions section 0 never reaches, and the difference is one
    afternoon's measurement rather than an argument.

---

## WHAT ONLY PAUL CAN DECIDE

Each is one question naming the thing to listen for or look at. Nothing below
can be settled by a gate, and several of them are stated as arguments the
builder lost on purpose.

1. **The motif's play button — three states on one control.** ANSWERED WHILE
   THIS FILE WAS BEING WRITTEN, and the answer went the way its builder's
   verdict pointed. The ask was *"should tapping a motif TAB sound it?"*, with
   the builder's honest half attached: **right when writing, wrong when
   browsing** — you cannot compare three motifs' staves without sitting through
   or interrupting three readings. The tab-tap is retired (`0bc7114`): **a tab
   is for looking**, and hearing is a button of its own that cycles
   **off → once → loop → off**. The word on the button is the NEXT TAP and not
   the current state, because a single pass ends by itself and a button that
   named the state would have to be rewritten by the sound's own callback —
   a write into a control, which the frozen-DOM law forbids. What is left for
   you: **press it. Is one pass, then a loop, then silence the order your thumb
   expects, or should the loop come first?**
2. **Do the section colours read as "slightly different", or as decoration?**
   Seven blocks, 4% of a golden-angle hue mixed into the paper, contrast
   measured at 19.8:1. Scroll the whole page once. The question is not whether
   you can see them — it is whether they help you tell one block from the next
   without ever competing with `<mark>`, which is the page's one spelling of
   "this is sounding". If they read as decoration the retreat is `--wash: 2%`
   or `0%`, one property in one place.
3. **The silence before the first note.** Press play and count. On an idle box
   it is roughly **4.5–6.5 s**; under the soak's two busy cores the A/B is
   exact — **first heard sample at 9.78 s with the prefill and 7.50 s without
   it, and the one without it has an 853 ms dropout at t=4.1.** The ring fills
   before it releases a frame, which is what closed the start-up crackling; the
   price is silence, and **silence is the part you feel.** Is that trade right?
   If it is not, the retreat is a **smaller prefill, not none** — 5 s still
   covers the measured startup deficit (one 3.1 s bar plus ~0.6 s of producer
   shortfall) with about a second to spare.
4. **The catalog-wide tone change.** The family EQ reaches the sound for the
   first time, so **222 sampled chair-boxes that were carrying a non-flat
   `lo`/`mid`/`hi` that did nothing now do something** — about 1.5 dB, a dip
   near 1 kHz and a lift on top. Nothing in the stored numbers changed; the
   renderer stopped ignoring them. Play three records you know well. **Every
   record now sounds the way its own mix sheet has always described it** — is
   that an improvement, or did the box just get duller?
5. **Does the producer's ten-note stack read as one note?** It is **not
   capped** — measured, before anything was built: nine sentences stacked, ten
   rows drawn, each with its own more / less / take it off, `run` applying all
   nine in order. So if it feels like one, the problem is **discoverability and
   not capability**, and the fix is somewhere else entirely. Say three things
   in a row and tell us whether you could see that you had.
6. **`voice_choir`'s breath range was deliberately left wide.** The rule that
   cut `tract_voice` and `voice_lead` to one fifth of their travel puts
   `voice_choir`'s ceiling at **0.012 — below its own derived value of 0.08**.
   A slider whose top is under the number the record is already holding is the
   lie this page exists not to tell, so its range stands. **The module is what
   wants looking at.** Play a choir record and say whether the choir is hissy
   in the way the solo voice was.
7. **Gate 4 — Live.** `node tools/ableton/export-als.js --genre boombap --out
   /tmp/n.als`, then open it in Live 12.4.3. **Does it open?** Only Live can
   answer; `verify.sh` has always missed this. Opening it also settles Ask #1
   and unblocks Ableton P1.
8. **The deep runway.** Change a genre, the tempo, or a section *while it is
   playing*. Is the delay before you hear the change tolerable? It buys a
   buffer that does not empty by spending up to ~5 s of heard lag. If it is
   wrong the retreat is **5 s, not 3 s.**
9. **The master make-up is no longer a constant.** It rides toward −14 dBFS
   instead of sitting at +8.3 dB, capped so nothing comes out louder than it
   did. Play a loud record and a quiet one back to back — **does the box sound
   like it is levelling them, and do you mind?** A rider is a decision about
   whether the box has an opinion about loudness.
10. **The sixty new world anchors, as taste claims.** Play son (Havana 1928),
    choro (Rio 1900), mento (Kingston 1952), shidaiqu (Shanghai 1940),
    kroncong (Jakarta 1935), filmi (Mumbai 1960), rebetiko (Piraeus 1935),
    ragtime (Sedalia 1899), sacred harp (Philadelphia 1844). Every one is
    measurably DISTINCT — the African round's own test was that highlife fires
    782 timeline hits and 272 claps where rock fires neither — but **distinct
    is not right.** The question the machine cannot ask: **does each of these
    sound like itself, or like the default in a costume?**
11. **`zema` specifically.** The weakest anchor by its own author's
    measurement — **0.380 from `gregorian`** in the genealogy's feature space,
    flagged by the round that built it rather than found later. Its church
    organ is gone. **Should it be in the catalog at all?**
12. **`--cell: 36px` on a real phone.** Sixteen 36 px cells; 36 clears WCAG AA
    but not Apple's 44. Since the grids rotated the cost of going to 44 is a
    taller block rather than a second swipe per bar. **Does your thumb hit the
    cell you meant?** Do not ask for a toggle.
13. **The `IDIOM` table.** Ten family rows and about twenty anchor overrides
    are a taste claim. The precompose gate prints which family row each anchor
    resolved to. **Does a punk hook sound like punk?**
14. **109 hand-typed coordinates.** Every one was checked on land by
    point-in-polygon against the baked coastline. The gate catches a city in
    the sea; it cannot catch one 200 km off. Turn the globe once. **Is anything
    in the wrong place?**
15. **The twelve words a bus can be "called".** ambience, depth, bloom, throw,
    lift, smash, parallel, double, stack, blend, wash, sheen. They were chosen
    to be JOBS rather than effects, so that nothing on that row collides with
    the reverb-type knob under it — the collision you reported. That is a
    constraint satisfied; whether they are the right twelve is taste. **Open
    the row. Is there a word you would reach for that is not there?**
16. **The wiki links, as claims about music.** 191 of them, each with the
    argument for it written out in `WIKI.md`. Two rows got no link on purpose
    and the paragraphs say why. **Read the thirty-one rows that are not plain
    genre articles** — the 20 artist links, the 4 albums, the 7 broader — and
    say whether any of them is a wrong claim rather than a wide one.

---

## THE STANDING LAWS THIS WEEK EARNED

Written here because a newcomer will find this file before they find the
commit that earned each one.

**TEST THE ARTIFACT, NOT THE SOURCE.** Gates must read the RENDERED output.
Three features shipped broken while every check passed. The sharpest instance
is worth carrying: `test/sheets.js` was **surveying an empty room** — `#app`
boots on a list of five section names, so gates 1/2/3 took one snapshot of a
page with zero sheets on it, which made *"0 sheets drawn"* a real failure AND
*"NO DEVELOPMENT WORD IS A MENU []"* a **vacuous pass from the same
snapshot.** A check that passes because it looked at nothing is worse than no
check. Walking every view exposed three further failures the empty page had
been hiding.

The law has a second half this week added: **read the artifact's own
declaration, not a selector you remember.** `test/motif-frozen.js` A2 counted
`#staff [data-live="played"] > p > div`, a query written on the one day that
layout existed. `ui/eight.js`'s header says the rule *"never was a number"* and
that a live surface **declares itself in the HTML**; the gate's own preamble
already says it *"asks the page itself what it marked live … rather than
inventing an exclusion of its own"* — and then one assertion invented one
anyway. Ask what is live; do not remember what was.

**DRIVE THE PAGE LIKE A PERSON.** `page.click()` scrolls its own target into
view before clicking it, CenterIfNeeded. That single fact produced **four
false bug reports** in one round — "a tab click lands on the same absolute
scrollY from any start", "no script calls a scroll API", "`overflow-anchor:
none` did not fix it" — and sent the round sideways until the arithmetic
(2251.09 + 22 − 422 = 1851) was noticed. Tap the element at its own on-screen
point. A harness that manufactures the effect it is measuring is not a
measurement.

**ONE OWNER PER FACT.** Two owners of one fact is the bug that hides, and the
board round found one by looking for it: a bus's `goes to` was printed both by
a `.nu-why` under the control and by the `goes to` ROW four rows down — *"on a
one-hop route those are the same words, which is what made the duplication easy
to miss."* The general mechanism is now a gate: `desk-gate` counts every rack
control and fails on a **duplicate `data-k`**, because *"a control drawn twice
is two owners of one fact, whether or not either copy is refused."* Today's
`selects`/`desk-gate` collision is the same law one level up — two GATES
asserting opposite things about one widget, because the widget moved and only
one of them was told. When a fact moves, the gate that does not own it stops
mentioning it rather than following it.

**ABSENT IS TODAY, AND IT IS PROVED FIRST.** A key that is not in the document
must render byte-identically to yesterday. Every new field this week was
spread and not assigned, and the identity was measured before the feature was
believed: `fm2op`'s four constants became `mp()` calls **defaulting to the
constants that were there**, so every record that says nothing is byte-identical;
`no dx7Preset` is `E.PIANO 1` byte for byte; a take of 0 or 1 or absent is take
one and every record before the change renders identically.

**THE CONVERSION IS DONE BY EXTRACTION, NEVER BY HAND.** `gates.json`,
`knobs.js`, `wiki.js`, `INSTR_YEAR`, the option table, the atlas's `WHEN` — all
derived from the running box, committed, and re-derivable with a `--check` that
fails on drift. The corollary this week added: **a derivation is only as good
as its corpus.** The option table was extracted correctly from a corpus of one
record wearing 139 labels, and being correctly extracted did not make it true.

**REVERSALS ARE REWRITTEN, NOT DELETED.** When a design decision is reversed,
the old sentence stays above the new one with the measurement that reversed it.
This week: the motif transform icons (drawn contours → unicode arrows, because
a reader read "the record's own" as "default"); `fx` on instruments (put back
on 2026-08-24, taken off again on 2026-08-26 by Paul's own words, with the
argument for putting them back preserved as the reason there is now a fourth
bus); PLAN.md's *"No icons anywhere"*, narrowly reversed and then narrowed
again. A deleted argument is an argument somebody will have again.

**AN AFFORDANCE NOBODY CAN SEE IS NOT A CONTROL.** You could already sound a
motif by tapping its tab, and a probe of the deployed page confirmed the buffer
source firing — so by every measurement the feature worked. Nothing on the
block said so. The gesture was invisible, and an invisible gesture is a feature
report, not a feature. Its replacement carries the other half of the law:
**a control says what pressing it will DO, not what state it is in.** A button
that named its own state would have to be rewritten by the sound's own
callback, which is a write into a control while the record plays — forbidden by
the frozen-DOM law — and it would go stale the moment a single pass ended by
itself. The word is the next tap; the live sentence beside it is the state.

**A GATE THAT ONLY EVER SKIPS IS A CLAIM NOBODY IS MAKING.** When the shipped
page stopped having a radio-group sheet, the traversal assertion was not
deleted and not left skipping — the same file runs a second time against
`test/fixtures/sheets-harness.html` as the `sheets-tier` gate, so the claim
keeps being made where it is still true.

**AND A BROKEN GATE ASSERTS NOTHING — WHICH IS WORSE THAN A RED ONE.** Three
gates were found *crashing* rather than failing on 2026-08-25 (`sheets.js` at
`readDev` on a null key, `producer.browser.js` at `hot.prod.notes[0].w`), each
taking every assertion after it down with it. It happened again TODAY, inside
this file's own repair: emptying `test/selects.js`'s `MULTI` table made
`MULTI[capKey].max` throw, and the whole gate went from "1 of 52" to a
stack trace. **When you delete the last row of a table, look for the code that
assumed there would always be one.**

**A GATE IS A TRANSCRIPT OF A DECISION.** All four of today's red gates were
green when they were written and were made untrue by a later decision — three
of them by Paul, in his own words, over the following forty-eight hours. That
is not a failure of the gates; it is what gates ARE. What it means in practice
is the sentence at the top of this file: **run the suite before you believe a
tree**, and when a gate goes red, ask what CHANGED before you ask what broke.

---

## THE DEEP REPORTS, AND HOW FAR EACH ONE CAN BE TRUSTED

* `AXES.md` — the eight axes, and why genre is a correlation and not a ninth.
  Current, and it is the shortest way in.
* `PROGRAM.md` — the order the 2026-08-24 round was built in, and the contract.
  **Its §4 numbers are pre-expansion** (122 and 139 anchors where the box has
  199) and **its §5 gate table still prints assertions four gate files have
  since rewritten.** It now opens with a dated header saying exactly which of
  its parts have gone stale and which are still binding; nothing below that
  header was edited, because a contract you can no longer read as it was
  written is a contract nobody can check a reversal against. **Read it for the
  CONTRACT, not for the counts.**
* `WORLD.md` — the tier rules, the `cannot` field, the primary-fact rule, and
  the coverage grid. **Its §4 catalog frame is the BEFORE picture** (124
  anchors, 86.3% Euro-American); the world round executed against it and the
  after numbers are in this file and in the commit.
* `INTERVIEW.md` — the generated-shape/shared-wording decision. Its measured
  numbers were taken at 139 anchors.
* `VOICE.md` — the voice and instrument editors. Current, and §13 is the
  honest record of six places the build disagreed with its own spec.
* `EQ.md` — the board's three knobs and the tape. Current. Its §7 latent
  ping-pong hazard is **closed** as of `test/pp-send.test.js`.
* `WIKI.md` — GENERATED. 191 rows, each with its argument and the article's own
  first sentence, so it can be checked by reading.
* `AFRICA.md` — the fourteen African anchors and the genealogy repair, and the
  best "what is still wrong" list in the building. **Items 1, 2 and 5 are now
  fixed** (`inv`, the guest pool, `latinpop`); 3, 4 and 6 stand.
* `MOTIF.md` — the page that moved while it played. Its item 2 is fixed; item 1
  is not. **Its gate table is a snapshot of a tree three other rounds were
  rewriting underneath it and should not be read as a verdict.**
* `GLOBE.md` — the earth. Written 2026-08-24, so **its "Still open" list
  predates the commits that fixed its top two items.**

* `nukernel/state.html` — not a report but worth knowing about: the whole record
  as indented JSON in a `<pre>`, written by `node nukernel/state-page.js` and
  EXTRACTED from the running data tier. No stylesheet, no module graph, no
  engine — *"there is nothing that can fail between the state and your eye."*

---

*Written 2026-08-26 against `2c0454d`. **Three commits landed under this file
while it was being written** — `0bc7114`, `b68066d`, and the one carrying its
own gate repairs — which is itself the argument for its first section: if you
are reading this on a later tree, every number here is a claim about the day it
was taken, and the suite that would tell you otherwise takes twenty-six
minutes.*
