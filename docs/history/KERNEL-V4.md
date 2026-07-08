# KERNEL-V4 — design review & reset proposal

*Analysis round, 2026-07-03. Read-only review of `genre-kernel.js` (1859 ln, 61
anchors), `csd-engine.js` (939 ln incl. the uncommitted rubato/thunk diff),
`genre-verifier.js`, GENRE-SPACE / FAUST-PORT / VALIDATION, and the git
history. Margin data below is from a fresh `node genre-verifier.js matrix`
run (61/61 diagonal-dominant) with per-row margins computed from the raw
matrix. Line numbers cite the current working tree.*

The one-sentence diagnosis: **the kernel's vector-space thesis is sound and
verified, but its composition layer is still the 2026-05 vaporwave builder
wearing 61 hats** — royal-road fallbacks, a pop form 34 of 61 anchors inherit,
8-beats-per-chord everywhere, pads and found-beds structurally mandatory, six
incompatible rhythm representations, and every new genre idea (horn, ding,
stations, vocal, rubato, counterpoint) landing as a one-off special case. The
deep passes (blues committed at `6b2f851`, tango via `9b5149c`, neoclassical
in the current uncommitted diff) show exactly what the fix looks like — they
just can't scale to 58 more genres as hand surgery.

---

## 1. Per-genre scorecard

Grading axes: **identity coherence** (does the anchor produce what its `info`
string promises), **acoustic/synth fit** (is the timbre source right for the
genre), **legacy bleed** (how much of the sound is un-overridden vaporwave
default), **euclid/structure** (does the rhythm come from real structure or a
shared kit shuffle), **form fit**, and **margin** (self-score minus best rival
from the fresh matrix — the falsifiable column).

Legend: form `pop*` = default pop form (the old builder shape); Eu = euclid
spec on the anchor (11/61 have one: techno L399, jungle L424, dubstep L610,
garage L707, industrial L754, idm L852, electro L865, minimal L962, breakcore
L1036, arabpop L1085, afrobeat L1110); Ac = sampler/acoustic voice in a lead
role.

| genre (anchor line) | mgn | rival | form | Eu | Ac | grade | verdict |
|---|---|---|---|---|---|---|---|
| techno (396) | 2 | psytrance | dj | ✓ | – | B+ | Real machine identity (E(7,16) hats, drone harm) but pads prob .9 is wash residue; psytrance camps on its features. |
| house (409) | 10 | canawave | dj | – | – | B+ | Solid: claps, shuffle, house_min7. Canawave as rival is a target artifact, not a sound problem. |
| jungle (421) | 1 | breakcore | dj | ✓ | – | A− | Best sample-forward anchor (real amens, tresillo kicks); margin 1 is family crowding by design. |
| triphop (434) | 1 | lofi | pop* | – | – | C+ | The oldest confusion pair; dusty-slow-boombap is shared with lofi almost feature-for-feature. Deep-pass candidate. |
| vaporwave (446) | 6 | sovietwave | pop* | – | – | A | It's the origin point; the space is literally built around it. Fine — the problem is everyone else inheriting its defaults. |
| synthwave (459) | 7 | transitwave | pop* | – | – | B+ | Drive bass + supersaw + phaser reads; ARTIC gives it a real envelope identity (L1185). |
| lofi (471) | 2 | downtempo | pop* | – | – | B− | Crackle-defined (fx L479: crackle .5–.8, highcut). Identity is production, not composition. |
| downtempo (483) | 1 | vaporwave | pop* | – | – | C− | The default with a different name: slow, washy, boombap, bed. Vaporwave scores 99 on it. Deep-pass candidate. |
| ambient (495) | 1 | downtempo | wave | – | – | B | Legitimately owns the drone corner (ARTIC L1188, kit off) but the wash cluster crowds it. |
| dinosynth (507) | 2 | sovietwave | ritual | – | – | A− | Bespoke ritual form + creature solos + glitched VO = real identity; all of it special-cased in buildSections (L1500–1515). |
| canawave (520) | 2 | dancepop | anthem | – | – | A− | Anthem form, kpluck Edge arp, goal horn, loon. Identity great; hornSource/vox plumbing is architecture debt (L534, L1629). |
| transitwave (537) | 3 | shibuyakei | transit | – | – | A | The best-realized genre in the catalog — and the worst architectural citizen: horn+ding+stations+vocal+poem are five one-genre engine features (L551–557). |
| neoclassical (558) | 2 | vaporwave | wave | – | ✓ | A− | Deep pass in flight (uncommitted): felt-piano sampler lead/bass, swelling strings, rubato prob 1, counterpoint, thunk (L565–579). The v4 model for "performance dimensions". |
| dancepop (582) | 5 | synthwave | pop* | – | – | B− | Competent pool-shuffle pop; DX7 New Order bass is a nice touch; little that's *only* dancepop. |
| edm (594) | 8 | techno | drop | – | – | B− | Pump .55–.8 IS the genre here; chops role + jux help. Feature-thin beyond production. |
| dubstep (607) | 8 | techno | drop | ✓ | – | B+ | Wobble + halftime + E(5,16) is real. But darksynth scores **100** against its targets — dubstep's verifier row is too loose (see darksynth). |
| blues (621) | 1 | jazz | pop* | – | ✓ | A− | The committed deep-pass exemplar: upright bass, comping organs, blue-note bends, 78rpm response vox, true triplet shuffle (engine L313–315). Margin 1 vs jazz is target overlap between two acoustic anchors, not mush. |
| jazz (632) | 19 | tango | pop* | – | ✓ | B+ | Upright + sax + walking = works. But pop form and 8-beat chords mean it can never actually *swing through changes*; ii-V-i at one chord per 2 bars is jazz at half harmonic speed. |
| dub (644) | 5 | downtempo | dj | – | – | B | "The delay IS the genre" (L644) — honest and production-defined; drum delay-throws land. |
| trance (655) | 8 | gabber | drop | – | – | B− | Arps + pump + uplift progression; adequate, generic. |
| disco (667) | 4 | acidhouse | pop* | – | – | C+ | No chank guitar, no strings stabs-on-4ths, no four-on-floor-with-open-hat signature — it's dancepop with different fx numbers. |
| italo (679) | 3 | transitwave | pop* | – | – | C+ | Arpeggio confusion with transitwave/synthwave; nothing italo-specific (no octave bass w/ pitch-bend cheese). |
| bigbeat (692) | 10 | industrialmetal | drop | – | – | B− | Chops arsenal (dcc one-shots) gives it real material; drums could be louder in identity terms. |
| garage (704) | 9 | darksynth | pop* | ✓ | – | B− | Heavy swing + E(7,16) skippy hats = genuine 2-step gesture; pop form blunts it (needs cut-up vocal culture). |
| doomdrone (716) | 6 | downtempo | wave | – | – | B− | Wash-cluster member saved by grit + funeral bpm. |
| newage (728) | 1 | downtempo | wave | – | ✓ | D+ | Indistinguishable in construction from ambient/downtempo (organ/saw/choir pads, bed, slow). Flute sampler is the only fingerprint. Deep-pass candidate. |
| exotica (740) | 1 | spacelounge | pop* | – | ✓ | C | Has vibes/sax but no birdcalls, no bongo/clave layer — and spacelounge is its twin (99 both ways). Pass them as a pair. |
| industrial (751) | 3 | techno | dj | ✓ | – | B− | E(11,16) clatter + factory beds + grit: coherent, but lives in techno's shadow (97 as techno). |
| spokenword (765) | 5 | vaporwave | pop* | – | ✓ | B− | Voice-led with real poets; instrument bed appropriately deferential. |
| chiptune (776) | 9 | gabber | pop* | – | – | C | A chiptune with supersaw stacks and no pulse-width/arpeggio-chord idiom is cosplay; needs a square/PWM instrument identity, not fx. |
| chinawave (787) | 7 | italo | pop* | – | – | C+ | Self-flagged placeholder (no dedicated source shelf reaches the mix); pentatonic lead + choir carries what it can. |
| sovietwave (799) | 3 | synthwave | pop* | – | – | C+ | Same: synthwave sibling until the Red Army shelf actually lands in the foreground. |
| citypop (814) | 3 | italo | pop* | – | – | B− | Ironic: the royal-road genre itself is a pool-shuffle. No chank guitar, no slap bass model — the two things that say citypop. |
| shibuyakei (826) | 7 | dancepop | pop* | – | – | C+ | Syncopated bass + vibes/flute is a gesture; the collage/sample-culture core of the genre is absent. |
| bossanova (838) | 2 | spacelounge | pop* | – | ✓ | B− | Real nylon guitar lead, but no clave/bossa rhythmic cell in the bass-drum relationship (bossa kit exists in the engine, L103 — rhythm isn't structured *against* it). |
| idm (849) | 1 | industrial | pop* | ✓ | – | C+ | **The genre v4 exists for.** E(5,16)×E(11,16) tangle is right; then it's poured into verse-chorus pop form and gets the same global 25% transform rate as everyone (engine L799–826). Its `info` promises "drum tangles that never repeat" — the architecture can't deliver per-genre transform density. |
| electro (862) | 8 | industrial | pop* | ✓ | – | B | E(3,16) tresillo claps replacing the backbeat (engine L342) + vocoder = the best "euclid as identity" example after afrobeat. |
| miamibass (876) | 3 | acidhouse | pop* | – | – | C+ | 808 boom + horn stabs; no cowbell lane, no double-time booty split. |
| phonk (887) | 4 | dubstep | pop* | – | – | C+ | No cowbell melody, no Memphis vox chops — grit+sub reads as generic dark. |
| witchhouse (899) | 1 | downtempo | pop* | – | – | D+ | Wash + grit + halftime ≠ witch house. Needs pitched-down vox (the shelf exists! vx_* at L50–73), detuned occult intervals. Deep-pass candidate. |
| mallsoft (911) | **0** | vaporwave | pop* | – | – | D | Vaporwave scores 100 on it — it is literally vaporwave, slower and wetter (L911–922). Either give it a muzak-sampler identity (elevator strings, PA reverb, crowd beds) or admit it's a *region* of vaporwave, not an anchor. Worst-in-class with darksynth. |
| wintersynth (923) | 5 | downtempo | wave | – | – | C+ | Frost triads (seventh:[0,.55] target) is a clever symbolic wedge; sonically still the wash cluster. |
| gabber (935) | 19 | techno | dj | – | – | B+ | Brutality as identity works: distorted kick kit, comp .65–.9, no legato. Second-best margin in the catalog. |
| psytrance (947) | 3 | gabber | dj | – | – | B− | Rolling bass at 145 = real; everything else techno. |
| minimal (959) | 2 | industrial | dj | ✓ | – | C+ | "Repetition as texture" needs the transform algebra (sparse mutations over long spans); currently just a quieter techno. |
| deephouse (972) | 2 | house | dj | – | – | C+ | House clone with shuffle; acceptable as a *region*, weak as an *anchor*. |
| coldwave (984) | 1 | chinawave | pop* | – | – | C | Rival = chinawave is a red flag (nothing shared musically). Needs stark drum-machine dryness + bass-led post-punk gesture; currently synth-pop pools. Deep-pass candidate. |
| ebm (996) | 3 | techno | dj | – | – | B− | Piston identity (quantized fuzz stabs, comp .55–.8) distinct from industrialmetal's slam per the anchor comments — barely distinct in features. |
| krautrock (1009) | 2 | disco | dj | – | – | C+ | Motorik should be unmistakable; a motorik *kit* + 8-minute one-chord form would do it. Confusable with disco = the pools are doing the talking. |
| newjack (1021) | 7 | canawave | pop* | – | – | B− | The swingbeat kit is real engine vocabulary (L323: bouncing kicks, huge claps); a good example of kit-level identity paying off. |
| breakcore (1033) | 10 | jungle | drop | ✓ | – | B | Amen chops + E(5,16) kicks punching through + max jux: the Strudel lessons composed correctly. |
| acidhouse (1046) | 5 | techno | dj | – | – | B | The acid bass model is a real instrument identity; works. |
| surfrock (1058) | 14 | dubstep | pop* | – | ✓ | C+ | Lowest self-score in catalog (95). Steel-string lead exists but no twang/spring-reverb/tremolo idiom; the dubstep rival means its own targets barely describe it. |
| spacelounge (1069) | 1 | exotica | pop* | – | – | C | Exotica's twin (99/99 mutual). Merge-or-differentiate decision needed. |
| arabpop (1082) | 1 | transitwave | pop* | ✓ | – | D+ | Honestly self-flagged (L1082: no Arab-world shelf). Deeper problem: hijaz progression exists but the pitch system can't say quarter-tone and the mode dimension never reaches ornament/melisma. Rival transitwave = features are all generic. |
| tango (1094) | 10 | sovietwave | pop* | – | ✓ | A | Deep-passed (`9b5149c`): bandoneon always, habanera-only bass, dry milonga room, pads mostly purged. Proof that instrument-identity + one rhythmic cell = genre, even inside the wrong form. |
| afrobeat (1107) | 2 | disco | dj | ✓ | ✓ | A− | The euclid showcase: E(3,16) kicks interlocking E(11,16) shekere, dorian vamp, horn hits. Margin 2 vs disco says the *verifier* can't yet see interlock — a v4 feature gap, not an anchor gap. |
| desertblues (1119) | 7 | bossanova | pop* | – | ✓ | B | Real guitar lead, pentatonic hypnosis, tape-worn top; coherent. |
| sludgemetal (1131) | 6 | downtempo | pop* | – | – | C | A sludge track with a pre-chorus, a bridge with found-sound bed, and an outro pad (L1556–1566 default form) — and its nearest rival is *downtempo*. The fuzz wall is right; everything around it is vaporwave scaffolding. Deep-pass candidate. |
| industrialmetal (1143) | 4 | darksynth | pop* | – | – | B− | The slam reads (comp+grit+jux); pop form again; sibling-blur with ebm/darksynth. |
| darksynth (1155) | **0** | dubstep | drop | – | – | C− | Worst margin in the catalog: scores 100 as dubstep. Construction is decent (fuzz/stack trading, 909 gated snare) — the failure is jointly its thin identity and dubstep's loose targets. Deep-pass candidate (with a dubstep target-tightening). |

**Grade distribution:** A/A−: 8 · B range: 24 · C range: 25 · D range: 4.
The A's are exactly the anchors that got bespoke forms, bespoke instruments,
or deep passes. The C/D mass is the pool-shuffle middle: pop* form + shared
saw/stack/brass pools + fx-only differentiation.

**The 10 deep passes to queue** (blues/neoclassical/tango are the template):

1. **darksynth** (margin 0) — chug-gate bass identity + horror-lead interval set; *and tighten dubstep's target row* (a genre scoring 100 as another is a verifier bug too).
2. **mallsoft** (margin 0) — muzak sampler shelf (elevator strings, mall PA beds, crowd walla) or demote to a vaporwave region.
3. **witchhouse** (margin 1) — pitched-down vox chops from the existing vx_ shelf, occult detune, drag-drop triplet hats.
4. **downtempo + newage** (margins 1/1) — the wash-trio disambiguation with ambient: give downtempo a *groove* identity (Bristol-adjacent perc lanes) and newage a *timbre* identity (bells/breath/harp samplers), or the three stay one genre with three names.
5. **exotica + spacelounge** (margins 1/1) — one pass, two exits: exotica gets birdcall hits + bongo/clave pulse-sets; spacelounge gets theremin-ish lead + tape-echo idiom.
6. **arabpop** (margin 1) — the maqam problem: ornament/melisma as a melody-transform, quarter-tone-ish inflection via pitch-bend, plus the missing source shelf.
7. **coldwave** (margin 1) — drum-machine starkness: dry mono room, bass-as-lead, brittle preset-DX7 tines.
8. **triphop** (margin 1) — its identity is *the break, slowed and dusted*: make it break-role-first (it currently defaults to bed) with cinematic strings stabs.
9. **idm** (margin 1) — not an instrument pass: a *structure* pass. Needs per-genre transform density/pool (see §3.2) and a non-pop form. The v4 pilot genre.
10. **sludgemetal** (margin 6 but form-broken) — riff-cycle form (theme × n with degradation), no bridge-bed, feedback as sample-event.

---

## 2. Legacy audit — where vaporwave-era assumptions live structurally

Each item: what/where, and blast radius.

**2.1 `defaultState` is a vaporwave preset, not a neutral zero.**
`csd-engine.js:180–192`: bpm 88, `progression:"royal_road"`, `reverb:0.85`,
delay .75/.30/2600, foundSources = three Tokyo field recordings pitched to
~.78 (L185–189). `defaultInstruments()` L134–141: saw pad cutoff 1400 send
.55, stack melody send .45, drums send .18. **Blast radius:** every state
field an anchor forgets to specify renders as vaporwave; the verifier's
`wash` feature (verifier L47) reads pad/drum sends, so a lazy anchor drifts
toward the wash cluster *silently*. This is why the confusion matrix's
center of gravity is vaporwave/downtempo (12 of 61 genres have a wash-family
rival).

**2.2 royal_road as the universal fallback.**
`csd-engine.js:560` (`PROGRESSIONS[state.progression]||PROGRESSIONS.royal_road`),
`genre-kernel.js:1460` and `:1835` (same pattern in buildSections and journey
duration math). **Blast radius:** a typo'd progression renders city-pop maj7
harmony instead of failing. Gate 6 (VALIDATION L32) catches anchor-level
dangling refs, but the fallback still masks runtime/blend edge cases.

**2.3 The pop-form bias: 34/61 anchors run the 2026-05 builder song.**
Default else-branch `genre-kernel.js:1556–1566` = intro/verse/pre-chorus/
chorus/verse2/bridge/chorus2/outro — the original vaporwave builder shape
(`csd-engine.js:161–178` `generateSong` is its ancestor). Structural
vaporwave-isms inside the forms themselves:
- **bridge always forces `pads:true` + `found:fnd("bed")`** (L1563) — sludgemetal and idm get a granular ambient bed bridge no matter what;
- dj `breakdown` forces `pads:true, found:fnd("bed")` (L1473); drop `break` likewise (L1483);
- intro/outro are always pads+found (L1558, L1565).
**Blast radius:** every non-bespoke genre has a washy ambient middle section
and bookends. That's a vaporwave *formal* signature applied to tango, jazz,
gabber (dj spared for gabber, but the breakdown bed still lands). It also
caps identity: the three bespoke forms (ritual L1500, anthem L1516, transit
L1534) are where the A-grades come from, and each cost an else-if branch plus
engine special cases.

**2.4 CHORD_BEATS=8: harmonic rhythm is not a dimension.**
`csd-engine.js:99`; assumed at engine L561 (cycleBeats), L237 (euclid step
scaling), fill placement L755–757; kernel hardcodes `*8` at L1460, L1599,
L1835. **Blast radius:** (a) no 3/4, 6/8, or odd meters — tango and
neoclassical live in forced 4/4×2-bar cells; (b) every genre changes chords
every 2 bars regardless of the "harmonic motion" dimension GENRE-SPACE.md:20
promises — jazz can't play changes, blues_12 (engine L94–96) runs its 12 bars
at half speed (12 chords × 8 beats = 24 measures per chorus); (c) euclid
patterns are locked to n≤16 steps mapped over 8 beats.

**2.5 Reverb-send defaults: every voice is born wet.**
`csd-engine.js:134–141` (pad .55 / melody .45 / drums .18 send) plus
role-hardcoded sends in buildEvents: narration rsend .4 (L601), distant hits
.9 / wet .6 (L650–651), vox .32/.26 (L664). Anchors *fight downward* — the
neoclassical diff literally comments "reverb DOWN a notch … felt piano is a
close mic, not a cathedral". **Blast radius:** dry genres (coldwave,
afrobeat, tango, transitwave) are exceptions maintained by hand; the wash
default is why gate-3's most-confused list is wash-on-wash.

**2.6 The found-role trichotomy + "found is mandatory".**
Roles bed/chops/break (+bolted-on narration/hits/vox/speech) route in
buildEvents L571–617; `fnd()` (kernel L1463) injects the anchor's found role
into nearly every form section; constrain() forces roles at L1431–1437
(kit off → bed, bpm<70 → bed, etc.). **Blast radius:** every genre must
carry found sound — for tango/neoclassical it's an aesthetic excuse ("room
air"), for chinawave/arabpop it's confessed filler (L787, L1082 comments).
The trichotomy also can't express the interesting placements, which is why
the special-case fields below exist.

**2.7 Special-case sample fields — the strongest v4 argument.**
Each of these is one genre's idea, implemented as a named field through the
whole stack (anchor → resolveMulti extraSide L1347–1352 → toState emission →
bespoke buildEvents handler → gate-6 enumeration in VALIDATION L32):
- `hornSource/hornVol/hornCut` — canawave goal horn L534, transitwave train L551; toState L1629–1633; hits remap L1713.
- `dingSource/dingVol` — transit door chime L552; toState L1634+; engine handler ~L685–694 (ppsend .7).
- `stations` — 96 metro-name samples (L150–243!), `stationPool` toState L1688, engine buried-sample scheduler ~L867–886 (one under every measure).
- `vocal/vocalVol` — WORLD-vocoder sung chorus L554, toState L1652–1654, engine ~L678, external sing.py contract.
- `vox/voxPool/voxClean/poem` — dinosynth/canawave/transitwave narration closures inside buildSections (L1507, L1519–1521, L1541–1543), glitch handler engine L595–612.
- `solo/counter` recipes inline in form branches (L1504–1506, L1522, L1544–1545) — synthesis recipes living inside *section lists*.
- `rubato/thunk/counterpoint` — the new performance dimensions, currently drawn "LAST like the inserts" with hand-rolled spec helpers (L1387–1421) to protect rng draw order.
**Blast radius:** ~90 lines of SAMPLES registry are transitwave-only; each
new bespoke genre grows resolveMulti, toState, buildEvents, and the
validator's special list. This is O(genres × features) code growth — the
signature of a missing abstraction.

**2.8 Pads-as-default.**
~40 anchors carry pads prob ≥ .8; forms force `pads:true` in six places
(§2.3); the default pad is a detuned saw wash into a .55 reverb send.
GENRE-SPACE.md:25 already frames pads as "prob + recipe", but the prior is
presence. **Blast radius:** absence-as-identity (dubstep's "ABSENT cavern"
.35, tango .3, gabber .35) is the marked case; it should be the unmarked one.

**2.9 Humanize was the only time-feel; now there are three, unintegrated.**
`applyGroove` (engine L539–546) does swing (+.16 beat on the "&") and
humanize (uniform ±.04 beat, ±25% amp) — one global knob pair. The blues
shuffle kit bypasses it with true-triplet placement and a comment explaining
why applyGroove won't double-swing it (L313–315). The uncommitted diff adds
`state.rubato` as a separate beat-warp stage (engine L887–905) and `thunk`
as a separate pass (L851–861). **Blast radius:** three timing systems with
different code paths and no shared vocabulary; no per-voice push/pull (bass
laid back, hats on top), no dilla-drunk grid, no tempo curves at section
scale. Note the kernel's rubato/thunk contracts existed in anchors *before*
the engine consumer landed — only readable in the working diff, invisible to
gate 6 (a dangling *behavior* isn't a dangling *reference*).

**2.10 Rhythm has six representations; euclid is an overlay, not a
foundation.** Kits are ~100 lines of procedural per-kind JS (engine
L245–343, 18 kinds); euclid is a *replacement overlay* on top (L329–343);
bass patterns are [offset,dur,pitch] tuples (L101, L207–216); melody is
MEL_PHRASES step arrays (L410–425); breaks are slice-index arrays (L550–555);
stabs/hits are named beat lists (L556–557). **Blast radius:** "do more with
euclid" currently means editing procedural JS per kit; a blend can't produce
a rhythm neither parent had (no pattern algebra); the verifier can't measure
interlock (afrobeat's whole point) because there's no uniform pattern object
to analyze.

**2.11 The Strudel transforms are global, not dimensional.**
The per-cycle transform pass (engine L799–826) is a hardcoded 5-case switch
at a fixed 25%/bar rate for every genre; only `jux` made it into the vector
space (kernel fx pools). **Blast radius:** idm/minimal/breakcore — the
genres *defined* by transform density — cannot express it; the Strudel
lesson (patterns as values + per-cycle function application) was borrowed as
a garnish, not as algebra.

**2.12 Leftover surface: `STYLES` presets (engine L143–160, royal_road
again) and `generateSong` (L161–178)** serve the tombstoned builder/play
pages; ARTIC (kernel L1179–1193) mutates 12 anchors' recipes at load time —
a patch on "everything collapsed onto the Royal Road lead voice" that v4
should absorb into instrument identity proper.

---

## 3. The V4 proposal

**Keep the thesis, reset the composition layer.** Unchanged: anchors as
typed-dimension bundles; `resolveMulti`'s blend algebra (pool-union,
weighted scalars, enum flips, constraints-last, coherence groups); seeded
determinism; the engine-state contract into the Faust voice layer; the
symbolic verifier + matrix + validate-genres gates; DX7/sampler registries.

### 3.1 Pulse-set rhythm as the foundation (not a bolt-on)

One pattern object for every rhythmic lane:

```
lane = { steps:16, cycleBeats:β,            // β from meter, not CHORD_BEATS
         gen: euclid(k,n,rot) | mask("x..x..x.") | weights([...]),
         accent:[...], microshift:±, everyCycle: rot|mutate }
```

- **Kits become data**: the 18 procedural kinds (engine L245–343) compile to
  named pulse-set bundles (kick/snare/hat/perc2 lanes + accent maps). The
  shuffle kit's triplet grid becomes `grid:"triplet"` on the lane instead of
  bespoke placement code. drumEvents shrinks to a ~40-line interpreter.
- **Euclid stops being an overlay that fights the kit** (L329–343 deleted);
  it is the kit's notation. techno = `{kick:E(4,16), hat:E(7,16,rot)}`.
- **Everything speaks it**: bass articulation, stab/hit placement, break
  slicing, even melody rhythm skeletons reference lanes — one analyzer for
  the verifier (which finally gets an *interlock* feature: cross-lane onset
  correlation — afrobeat's missing margin).
- **Blend rule**: per-lane pool union (combinatorial, like today's kits) +
  accent/microshift lerp. A blend can now also *transform* a parent's lane
  (rotate, densify) — new rhythm from old, deterministically.
- **Meter unlocks**: β per anchor (12/8 blues, 3/4 tango option), and
  harmonic rhythm becomes a real dimension: `chordEvery: beats` replaces
  CHORD_BEATS=8 (jazz 4, blues_12 4, drone genres 32).

### 3.2 Pattern-transform algebra as a first-class dimension family

Per-anchor `transforms: { pool:[rev,ply,degrade,rot,octflip,rest,jux,stutter],
rate:[lo,hi], targets:{drums,melody,bass}, schedule:"everyN"|"formAware" }`.
The engine gets ONE generic per-cycle transform pass replacing the hardcoded
switch (L799–826); defaults reproduce today's global behavior exactly (25%,
same 5 ops) so untouched genres are bit-stable. Blend = pool union + rate
lerp — idm gets rate .5 with the full pool, tango gets rate .05 with
{rest}, minimal gets `everyN:8` sparse mutations. Form-aware scheduling
(chorus stable / verse mutating) is the Strudel `every` lesson landed
properly.

### 3.3 Time-feel as one dimension family

```
timeFeel = { swing:{amount, grid:"8th"|"16th"|"triplet"},
             rubato:{depth, periodBars, phase},
             humanize:{timing, level},
             pushPull:{bass:+ms, hat:-ms, ...} }
```

Implemented as one composed warp in buildEvents: section-scale W(b) (the
uncommitted rubato warp at engine L887–905 generalizes cleanly — keep its
monotonic-warp math and drift-gate invariant), then grid-level swing, then
per-voice offsets, then per-event humanize. Deletes applyGroove's
special-casing, the shuffle-kit's double-swing avoidance dance, and unifies
the three systems of §2.9. Every anchor gets a time-feel signature; blends
lerp depths and pick grids by side.

### 3.4 A generalized sample-event role system

Replace bed/chops/break/hits/vox/speech/horn/ding/stations/vocal/poem with:

```
sampleEvents: [ { pool:[ids],
                  placement:"bed"|"slice"|"oneShot"|"response"|"buried"|"opener"|"cadence",
                  sync:"free"|"beat"|"measure"|"sectionEdge",
                  sections:"all"|"first"|"quiet"|regex,
                  treatment:{pitch,stretch,cutoff,glitch,clean,pp,keyTrack},
                  gain, prob } ]
```

Today's specials become configurations: goal horn = oneShot/first/full-gain;
ding = oneShot/sectionEdge/pp:.7; stations = buried/measure; sung vocal =
bed/chorus/keyTrack (the sing.py contract becomes a pool entry with a
render-time provider); paleo VO = response/glitch. One engine code path
(replacing the L571–751 cluster), one resolveMulti pool rule (union + one
coherence group), one gate-6 registry. Any genre can now have an opener or a
buried litany — the transitwave inventions become catalog-wide vocabulary,
which is exactly how bespoke charm should compound.

### 3.5 Form grammar replacing hardcoded section lists

Section *graph* with typed nodes — `ground, build, peak, release, exposed,
cadence` — plus per-anchor: energy curve, node preferences (what fulfills
"sustain layer": pads? organ comp? drone? nothing), decorations (solo slots,
counter slots, vox slots as graph attachments, not inline recipes), and
evolution rules (later cycles densify — today's L721–729 humanity pass,
promoted to policy; consecutive sections must differ in ≥1 layer). The seven
else-if branches (L1467–1567) become seven grammar instances in data;
ritual/anthem/transit are just graphs with bespoke decorations.

**The 3-min rule as a duration solver**: default `targetSec:180` for single
tracks (today only journeys pass targetSec; `track()` L1734 renders whatever
the section list happens to sum to), solver chooses cycle counts and node
repetitions to land 180±10% (replacing the blunt post-hoc `k` scaling at
L1598–1601 that only fires outside ±15%). Journey overrides per-leg as now.
Kill the forced bridge-bed and intro/outro pads (§2.3): the grammar requests
energy, the anchor supplies material.

### 3.6 Instrument identity as the primary timbre axis

Per voice, first choice is the *source class* — `sampler(zones) | dx7(patch)
| analog(saw/stack/acid/…) | mechanical(fuzz/noise)` — with per-anchor
weights, then the recipe. This formalizes what every deep pass did by hand
(blues→sampler bass, neoclassical→felt piano, tango→bandoneon) and absorbs
ARTIC (L1179–1193) into per-anchor envelope identity instead of a load-time
patch. The verifier's `acoustic` feature (verifier L64–68) stops being an
inference and reads the dimension directly. Silence stays a first-class
choice ("off" weighted like any source).

### 3.7 Migration: strangler phases, each behind `verify.sh`

Ground rules proven by the neoclassical diff: new dimensions draw from
**forked rng streams** (`seed+8181`-style) or draw **last**, so untouched
genres stay byte-identical; every phase ends with `validate-genres.js`
(gates 1/2/6 hard) + `engine.test.js` + matrix margins not regressed +
byte-diff of 61×5-seed state fixtures captured in Phase 0.

- **Phase 0 — baseline freeze** (0.5 d): render fixtures (state JSON +
  feature vectors, 61 genres × 5 seeds) into the verify harness. Nothing
  else.
- **Phase 1 — timeFeel unification** (1–2 d, lowest risk, rubato just
  landed): compose swing/humanize/rubato/pushPull into one warp stage;
  legacy fields adapt in. Gate: byte-identical for anchors without new
  fields; blues shuffle A/B by ear + offgrid feature unchanged.
- **Phase 2 — pulse-set core** (3–5 d, the big one): pattern compiler; port
  18 kits to data behind a flag; euclid becomes notation; drumEvents →
  interpreter. Gate: drum event streams identical (or ε-timing) per kit ×
  seed vs fixtures; full matrix.
- **Phase 3 — transform algebra** (1–2 d): genre-addressable pool/rate with
  global-default compatibility. Gate: fixtures byte-stable (default = old
  behavior); idm/minimal listening pass.
- **Phase 4 — sample-event roles** (2–3 d): generic engine path; port
  bed/chops/break first, then horn/ding/stations/vocal/vox as configs;
  delete toState L1629–1654 specials and the engine L571–751 handlers.
  Gate: gate 6 on the unified registry; transitwave/canawave A/B renders.
- **Phase 5 — form grammar + 3-min solver** (3–4 d): grammar interpreter;
  port pop/dj/drop/wave, then the three bespoke graphs. Gate: section
  count/energy tests; render-sample-video cut-lock still holds; duration
  within ±10% of target across 61×3 seeds.
- **Phase 6 — the ten deep passes on v4 machinery** (~0.5–1 d each,
  ongoing): §1 list, worst margins first; retire compat adapters as each
  family clears.

**Gets deleted** (the payoff): procedural kit bodies (engine L245–343),
euclid overlay (L329–343), transform switch (L799–826), applyGroove
special-casing (L539–546), the form else-if chain (kernel L1467–1567), the
special-field plumbing (kernel L1347–1352, L1629–1654, engine special
handlers), ARTIC load-time patching (L1179–1193), STYLES/generateSong
builder leftovers (engine L143–178) once builder.html is formally retired,
and the royal_road fallbacks (replaced by hard failure — gate 6's philosophy
applied at runtime).

Total: roughly two focused weeks of phases plus the rolling deep passes —
versus the current trajectory where every new genre adds another else-if and
another special field.

---

## 4. Risk / keep list — what v3 got right that v4 must not lose

1. **Determinism and rng draw-order discipline.** Same seed → same song is
   the space's existence proof (VALIDATION gate 1). The migration hazard is
   draw-order drift; the countermeasures are already invented here — forked
   streams (`seed+31337/424242/8181`), draw-last dimensions, "absent keys =
   zero behavior" — make them written law in v4, enforced by Phase-0
   fixtures.
2. **The confusion-matrix discipline.** 61/61 diagonal dominance, multi-seed
   win rates, margins as the tuning to-do list, cluster geometry, blend
   monotonicity (gates 2–5). Also keep the verifier's *independence*: targets
   live in genre-verifier.js, not in anchors — the generator must not grade
   its own homework. (Resist the temptation to co-locate them during v4.)
3. **Blend combinatorics, not averaging.** Pool-union with weighted sides,
   enum flips near midpoints, constraints last, coherence groups (vox rides
   its source parent, euclid rides the kit parent L1320/1361, DX7 morphs only
   within an algorithm). This is the product's core interaction and the
   reason midpoints are songs.
4. **The humanity rules** (GENRE-SPACE L110–113): nothing loops verbatim;
   ghost snares quiet by construction; hats drop out and levels breathe;
   fills resolve differently each time; the novelty memory in journeys
   (kernel L1784–1790: 5-field signature, ≥3-match reroll). In v4 these
   become grammar/lane policies — port them as *tests*, not vibes.
5. **The engine-state contract.** buildEvents-emits-events, Faust renders —
   FAUST-PORT's "kernel unchanged, only the sound layer moves" worked; v4 is
   the mirror image (sound layer unchanged, composition layer moves) and
   should honor the same contract line.
6. **The empirical backstop.** audio-verifier.py / Discogs-EffNet probes
   before shipping new genres (VALIDATION gate 7) — symbolic
   self-consistency lies eventually; the classifier doesn't.
7. **The bespoke content.** Goal horn, loon, 96 station names, the paleo VO,
   the Conet numbers stations, the 78s. V4 generalizes the *mechanisms*;
   losing the *material* would lose the project's soul. The SAMPLES/SOURCES
   registries port as-is into the sample-event pools.
8. **The deep-pass recipe itself** (blues/tango/neoclassical): instrument
   surgery → performance affordances → composition mutations → verify. V4's
   §3 dimensions are that recipe turned into infrastructure; the recipe
   remains how you *use* it.

**Residual risks:** the wash-cluster genres currently *pass* partly because
their targets overlap — v4 retunes (pulse-sets, interlock feature, tightened
dubstep/vaporwave rows) will flip some gate-2 wins red before they turn
green; budget a target-retuning pass per phase. The live explorer rebuilds
per chord-bar, so section-scale rubato phase restarts there (already
documented in the diff) — form-grammar evolution rules will hit the same
live/press divergence and need the same explicit caveat. And CHORD_BEATS
removal touches the video renderer's downbeat cut-lock — keep
render-sample-video in the Phase 5 gate.
