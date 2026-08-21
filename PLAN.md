# PLAN — the band's web interface program (2026-08-20)

The cleanup program (chair engine, kernel toolkit, plan/bpm on anchors,
to-engine dedup, parent-brain cut) lands first. Then this, in phases, each
executed as a reviewed workflow. Paul's brief, translated to specs — when in
doubt, the brief wins.

## Phase 1 — Plain HTML, one page, no modes

Strip ALL design until it is plain HTML. Simple boxes and borders. Buttons are
`<button>`, links are `<a>`, choices are radio buttons / checkboxes / `<select>`
/ `<datalist>` comboboxes — every HTML5 widget is welcome, styled by nearly
nothing. No icons anywhere: words instead (the dice ⚄ becomes "roll a record",
⟲ becomes "start again", the play button says "play" / "stop"). Get rid of
whatever can be gotten rid of.

No tabs, no modes. One vertically scrolling, accessible page:

    THEMES        (was "ideas" — see Phase 2) — with visible prose that
                  answers "how do I add themes" right there on the page
    ─────────────── a plain horizontal rule
    SONG          the structure as a set of boxes; a control that reads
                  "add a box" (a box is a section of the song)
    ─────────────── rule
    THE BAND      the members, each a plain block

Plain HTML aesthetics throughout: system fonts, borders, whitespace,
`<table>` where tabular data wants a table. Semantics first — this page
should read perfectly in a screen reader and with CSS off.

## Phase 2 — The question graph as an outline

Today the answered facts render as a flat bunch of lozenges; hard to scan.
Replace with an OUTLINE: hierarchical items, expanded — interdependent
question sets grouped under their parent (e.g. everything the drummer's
"record" answer unlocks nests under it). `<details>`/`<summary>` or a plain
indented list; the tree must be OBVIOUS. Grouping comes from the dependency
edges the vocabulary already has (question-trees gate knows them; chair.js
rows can declare their group).

Language pass, in the same phase (it changes what the outline says):

- "ideas" → "themes" everywhere, with short text explaining what a theme is
  and the different things one can be (a hook, a riff, a figure, a chant).
- A theme RENDERS AS SHEET MUSIC: notation via abcjs (github.com/paulrosen/
  abcjs, MIT) — VENDORED locally like vendor/three (the CSP is same-origin
  and the offline law holds: the page must draw the staff with the wire
  cut). The theme's own phrase (deg/oct/gate + the record's key and mode)
  compiles to an ABC string; abcjs draws the SVG staff beside the plain
  controls.
- Kill redundancy: never say "accent" five times in five options — say it
  once and offer the choices. Compose option bundles as TABLES with visual
  spacing, not word-piles.
- Rhythm micro-grammar: "on the e of the one" / "the and of the one" /
  "the a of the one" collapse to one row: **on the [downbeat] [e] [and] [a]
  of the [one] [two] [three] [four]** — pickable cells, not sentences.
- A composer/arranger review of every question: would Mancini ask it this
  way? MacKaye? Glasper? Tchaikovsky? Chopin? Jeff or Spencer Tweedy?
  Drozd? This is musicians communicating — each question should be the way
  a working musician would actually say it to another. Run a multi-voice
  review (several arranger personas per chair), synthesize, rewrite.

## Phase 3 — The genre space goes back to Rome, 600

Expand the catalog so a session can open anywhere from 600 CE forward:
plainchant Rome, organum Paris (Notre Dame, 1200), ars nova, Renaissance
polyphony and dance music, Baroque (continuo, fugue — a fugue genre exists),
Classical Vienna, Romantic piano and orchestra, salon, ragtime's ancestors,
and the folk/vernacular threads between. The front door's "what decade is
it?" grows a longer axis (century first, then decade where it matters).
Every new genre follows the two-table law (plan/bpm on the anchor after the
cleanup) and must leave the dice's completeness property true: every route
ends in a playable record. Instruments must map to what the sampler
actually has (choir, organ, strings, brass, lute≈nylon guitar, harpsichord)
— no genre may promise a sound the registry cannot play.

## Phase 4 — The band as a graph, and themes as living material

Today the song is hierarchical: arranger → players, nobody listens sideways.
Explore and build INTERACTION: what the drums do should affect the bass and
vice versa (the bass locking to the kick pattern; the drummer opening up
when the soloist climbs; comping thinning under a busy tune). Design it as a
graph of influences between chairs, not a deeper hierarchy.

THE THEME COMPOSER (Paul, 2026-08-21 — "be a real composer"; this leads
Phase 4): a theme is a CLAIM, not a pattern. Build:
1. MULTIPLE THEMES, named and few — A and B ("the tune" / "the answer").
2. ASSIGNMENT ON THE SECTION NODE — each section says which theme it
   carries and who takes it; the same theme over different sections'
   changes is the Jimmy Webb engine (recurrence over different ground).
3. THE PHRASE AS A SENTENCE — 2–4 measures, EACH with its own rhythm
   cell (statement / restatement / development / landing), never one
   cell photocopied. Father John Misty's law: no two measures of a sung
   line scan the same; a theme has a rhythmic profile — dense bar,
   sparse bar, the long note where it means it.
4. TIES AND LEGATO FIRST-CLASS — notes carry across cells and barlines,
   pickups start before the bar, legato is the default articulation of a
   sung theme. The staff must show the ties.
5. RETURN WITH TRANSFORMATION — the same · up a step · augmented ·
   fragmented (just its head). This is the seam where the theme composer
   meets the improvisation engine: trading and solos ARE transformations
   applied live.
   SHIPPED 2026-08-21, and with two laws the first cut was missing:
   - A THEME IS STATED WHOLE BEFORE IT IS FRAGMENTED (Paul: "I never hear
     the second half of the answer"). The tag role carries the one DEFAULT
     `back` — the hook's head, out the door — and the dice seats theme B on
     the last theme-carrying section, which in every form ending in a tag
     IS the tag. Measured over 120 rolls: 9 of the 47 records that compose
     an answer never heard B's second half anywhere; the bars the engine
     was handed for that section read 3 0 4 0. The canned fragment now
     stands down unless another section says that theme whole (band-kit
     `statedWhole`); an ANSWERED `back` is untouched. After: 0 records,
     and the same section reads 4 3 4 3.
   - THE STAFF SHOWS WHAT IS ACTUALLY BEING PLAYED (Paul: "can you visually
     rewrite the themes for their actual notes as you play them"). While
     the record plays, the sounding section's theme is re-engraved from the
     COMPILED SCORE (audio/plan.js timeline — the same per-bar artifact the
     engine is fed), so a transform, the record's key and the section's own
     changes are all visible; the note lights ride that engraving's own
     glyph map. Stopped, or in a section nobody carries the tune in, the
     staff is the written theme again and a caption says which ("as played
     in the drop: up a step" · "the tune is out in the break").

THE THROUGH-COMPOSED THEME (Paul, 2026-08-21, from the Yesterday study —
"yes, but I don't want to lose the flexibility of the recursive theme"):
the sentence machinery is the SOUL OF THE MACHINE and stays the default.
"Written out" is one more answer, never a replacement. Three modes, one
theme:
1. DERIVED (today): one authored bar, the sentence plan derives the rest.
2. AUTHORED: per-bar grids (the drum phrase's 7-lane grid is the
   precedent) — a 2-4 bar tune with every bar its own rhythm, ties
   crossing every barline.
3. MIXED — the interesting one: author bar 1, derive 2-4; or take a
   derived sentence and override just the bar that is wrong. THE HAND
   MOVES LAST (the lifts' existing law, extended to bars): a bar you
   wrote stays written through any sentence-plan change.
Alongside it, from the same study's gap list:
- AUTHORED CHANGES: an "other changes" escape so a 7-chord list makes a
  7-bar section (the kernel's at(roots,bar) already wraps any length —
  verified); per-at lift keys instead of at%16.
- SECONDARY DOMINANTS: a question that writes the kernel's existing
  borrow/dom7 chord fields ("make bar n pull toward bar n+1") — the
  Em7-A7 bar Yesterday is about.
- A 1960s CHAMBER-POP RECORD (the sixties, London/Liverpool, a studio:
  steel-string, keys incl. strings, kitless-or-brushes, aaba/full,
  descending + doo-wop changes) so the front door stops needing to lie
  about the century.
- FORM: a repeat mechanism (A-A-B-A-B-A), intro and tag roles.

Themes: develop real methods for improvising ON a theme — how musicians
actually explore one: restatement, transposition, inversion, augmentation/
diminution, fragmentation, sequence, call-and-response, reharmonization,
trading fours/eights, solo handoffs. Then: a session mode where the band
hands off improvised solos for hours over the record's themes — Paul wants
to hear what that is like. This needs design research before code: workflow
a theory pass (how theme development works, what the kernel can already
express, what's missing), then implement.

## Phase 5 — SKIPPED (Paul, 2026-08-21: "just skip stage 5")

The instrument room and its server-side notes log are OFF THE BOARD. The
reason is evidence, not fatigue: every note Paul gave in conversation —
the jangly guitar, the buried melody, the thrash blues, the fabricated
drums — was measured and fixed within hours of being said. The direct
channel IS the feedback loop, and it is faster than any page-and-log
round trip would have been. The droplet endpoint stays up (a tiny
sandboxed service holding the first guitar note); see the
stellate-notes-endpoint memory if it is ever wanted back.

## Phase 1a — Playback truth (rides with Phase 1)

- BUG: the song always slows down at the end and picks back up when it
  loops. Find the tempo map's ending behavior (a ritardando that belongs to
  a true ending is applying at the loop seam) and make looping seamless —
  an outro may slow only when the record actually ends, never when it wraps.
- A change you make while playing lands at a boundary, and the page should
  SAY when: "bass changes in 8 beats… 7… 6… 5…" — a live countdown from the
  moment the answer is given to the bar/section where it takes effect.
- Put a beat counter back in (bar.beat, plain text, always visible in the
  transport line).


## What the repertoire panel measured (2026-08-21)

Four records built by answering the page's own questions — Bach's
Invention (Leipzig 1723), Enjoy the Silence, Honesty, and three hymns —
plus Yesterday as the reference. The frozen benchmark (sessions, fit
scripts, 386 rip notes across four centuries) lives in the memory
directory under keeps/repertoire-benchmark; EVERY melody or meter slice
gets measured against it, before and after.

The verdict: exact melody pitch sits at 31-41% in every idiom and every
century — Bach 1723 and Depeche Mode 1990 within five points of each
other. That is a ceiling of the melody LANGUAGE, not of any mapping.
Rhythm is solved (zero missed onsets wherever written bars covered the
material). Authored harmony is near-perfect four for four. The box
stages records well and imitates across time — the theme A/B and
transform machinery is literally the invention's own development
devices. "Imitation yes, counterpoint no."

The convergent gaps, ranked by how many studies hit them independently:

1. METER — three of four studies, and it excludes repertoire before a
   note is written (Piano Man, the beginner Minuets, half of hymnody;
   SLANE shipped with every bar a third too long). THE CHOSEN NEXT
   SLICE, because it is the only one already half-built: the kernel
   speaks twelve-step bars (stressAt, stepsPerBar = deg.length),
   plan.js already feeds opts.barBeats, the parent has shipping 3/4
   anchors and waltz kits. The work is everything above the kernel that
   assumes sixteen: one arranger question, twelve-step grids for the
   chairs that carry them, wrote[b] validation, and a gate that renders
   one 3/4 record end to end. Acceptance test already exists — re-run
   the SLANE fit and watch the stretched bars disappear.
2. THE 4-BAR THEME CAP — all four studies; the single biggest fit
   limiter. Wants theme length 8 with written bars over all of it, plus
   an AABB sentence word.
3. THE REGISTER/LIFT CLAMP — all four; the dominant "off" category.
   Wants a per-written-bar (and, for pedal-alternation riffs, per-place)
   octave word.
4. A SECOND AUTHORED LINE — Bach's heart, the hymns' inner voices. The
   architecture already has the shape: themeB-as-layer with its own
   taker.
5. INVERSIONS — the kernel's chord objects already carry the field; the
   picker never asks it.

## Standing rules for every phase

- Verify at the score/DOM level pure-node where possible; browser gates for
  what only a browser can prove; the band-offline law (plays with the wire
  cut) must survive every phase.
- Staging (test.stellate.app) is the deploy target; prod only on explicit ask.
- The kits stay data over one chair engine; new questions are rows, not code.
