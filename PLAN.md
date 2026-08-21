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

Themes: develop real methods for improvising ON a theme — how musicians
actually explore one: restatement, transposition, inversion, augmentation/
diminution, fragmentation, sequence, call-and-response, reharmonization,
trading fours/eights, solo handoffs. Then: a session mode where the band
hands off improvised solos for hours over the record's themes — Paul wants
to hear what that is like. This needs design research before code: workflow
a theory pass (how theme development works, what the kernel can already
express, what's missing), then implement.

## Phase 5 — The instrument room and the feedback loop

A new page, linked from the band page: EVERY instrument (sampled, synthesized,
and the effects chains), each playable in its applications — a riff, a melody,
a pad — with a plain-text notes box per instrument. Notes save automatically
to the server (a tiny append-only endpoint on the droplet; the static site
stays static, the notes land in a JSONL log outside the web root). Then the
loop: Claude reads the log, diagnoses (e.g. "electric guitar is missing
crunch, bends notes all over the place, jangly"), improves the instrument
(zone selection, effects chain, velocity/articulation mapping), redeploys,
and marks the note addressed. Paul's goal: give as little feedback as
possible; Claude figures out what to do next. Many passes; the log is the
program.

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

## Standing rules for every phase

- Verify at the score/DOM level pure-node where possible; browser gates for
  what only a browser can prove; the band-offline law (plays with the wire
  cut) must survive every phase.
- Staging (test.stellate.app) is the deploy target; prod only on explicit ask.
- The kits stay data over one chair engine; new questions are rows, not code.
