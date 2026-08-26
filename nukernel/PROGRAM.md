# PROGRAM — the round of 2026-08-24

Paul gave one brief and nine designers took a slice each. Their notes are the
argument; this is the ORDER. It exists because nine designs that each edit
`ui/eight.js` are nine merge conflicts, and because the crackle has to be dealt
with before anything else is judged by ear. Read your slice note before you
build the slice — the nine are in `/home/ford/.claude/jobs/c1b341cb/tmp/design/`,
numbered `01-crackle` … `09-ableton` — and read this file for what the notes
could not settle alone.

The standing laws apply to every line below: **check the parent first**
(`git show main:<path>`), **the conversion is done by EXTRACTION, never by
hand**, **keep like with like**, and **test the artifact** — gates read the
RENDERED output, because three features have already shipped broken here while
every check passed.

---

## 1 · THE BRIEF, AS NINE DELIVERABLES

Paul, 2026-08-24, quoted where the quote settles something.

| # | deliverable | the sentence | acceptance test (one command) |
|---|---|---|---|
| **D1** | **The crackle.** The page tells you which engine it got and whether it starved; the runway is deep before the first hole, not after it. | *"after a few minutes the audio crackles like vinyl. look at the parent repo — we solved this there."* | `node test/soak-nukernel.js --mins 12 --load 2` exits 0 with `starve.episodes === 0` |
| **D2** | **The sheets.** Every `<select>` becomes a lit sheet of options; an option another answer has made unreachable is greyed **with a reason**. | *"the options for each instrument in a song section are now just one thing in a dropdown. That's not effective. sheets of organized options should light up. when an option makes another one unaccessible gray it out."* | `node test/sheets.js` — `#app select` is empty, and every `input:disabled` has a non-empty `.nu-why` |
| **D3** | **The engineer and the board.** Sends, buses, delay and reverb reach the ear; a mixing board at the foot of the page. | *"we've lost the engineer entirely. we've lost buses and sending things to them and delay and reverb." … "an actual mixing board at the end is a nice idea."* | `node nukernel/desk-gate.js` — G6 passes: the shipped chant carries `rev 0.78` **into a non-zero return** |
| **D4** | **The producer.** Six verbs, a cast built from this record, notes that stack and undo. | *"we've lost the producer entirely."* | `node test/producer-eight.test.js` — G1 byte-identical with no notes, G3 every reachable stack playable |
| **D5** | **Precompose.** `genreToDocument(gk, seed)` writes a whole record for all 122 anchors. | *"we've lost the ability to set a genre and have the entire song precomposed entirely."* | `node test/precompose.test.js` — 122 anchors × 3 seeds, no silent section |
| **D6** | **The atlas.** A time slider and a world map; scroll to a year, click a place, get a song. | *"a slider for time and a world map on top that shows where the genres are happening! I scroll to a time, click a place, and now i've got a song."* | `node nukernel/atlas.gate.js && node test/atlas.js` — clicking Kingston at 1969 makes `#title` read `Kingston 1969` |
| **D7** | **The nudges.** Arching, at all four scales; the section's own shape, its edges, and the phrase tent. | *"we had lots of fun nudges to the music and motifs — like arching."* | `node test/nudges.js` — `env:"arch"` moves the rendered velocities by ≥2, and a chant with no drummer greys all seven drum-writing edges |
| **D8** | **The shell.** Mobile scroll, bigger controls, sticky headings, grid lines, one stylesheet. | *"think about a way to scroll on mobile and the simplest possible ways we could make all the buttons bigger. it would be nice to have sticky headings as i scroll." … "keep the raw plain HTML but use more controls and a little bit of CSS. use more grid lines in tables, it will help."* | `node test/shell.js` — `scrollWidth === clientWidth` at 320/375/430/820 and zero controls under 44px |
| **D9** | **Ableton export.** One `.als` that opens. | *"you promised to make Ableton export work if I gave you a generic Ableton file; there's one at ~/Ableton.zip"* | `node tools/ableton/export-als.js --genre boombap --out /tmp/n.als && node tools/ableton/als-gate.js /tmp/n.als --genre boombap` |

---

## 2 · THE CONTRACT

Everything in this section is **fixed**. A builder who wants it different says
so before starting, not by shipping something else.

### 2.1 The eight-axes document, after this round

One value, nine top-level keys — the eight axes, plus `basis` (the anchor the
axes are stated against, `songs.js:89`) and `produce` (what somebody with taste
said about it; a session fact, not a ninth axis — `AXES.md:113`).

```jsonc
{
  "basis": "gregorian",

  "time": {
    "bpm": 58, "rate": 1, "meter": null, "swing": null,
    "groove": null   // NEW (D5) — a GROOVELABEL key. push() calls state.js:190
  },               //   setGroove, which has existed and never been called.

  "alphabet": {
    "key": 2, "mode": "dorian", "diatonic": true, "harmony": "modal",
    "prog": [{ "d": 0, "q": "triad" }],
    "scale": null    // NEW (D5) — a SCALES key, or null = the mode. 99 of 122
  },                 //   anchors declare one; ui/eight.js:98 overwrites it today.

  "material": {
    "cells": {
      "psalm": { "kind": "line", "deg": [...], "play": [...], "vel": [...], "acc": [...] },
      "beat":  { "kind": "drum", "lanes": { "k": [1,0,...], "x": [9,0,...,8] } }
    }
    // NEW INVARIANT (D5): every LINE cell in one document has the SAME length,
    // a whole multiple of stepsIn(meter). barsOf(doc) derives it; sections[].bars
    // counts CELL bars. Two lengths give two voices different bar arithmetic
    // against one total (derive.js:420). Drum lanes carry BY VALUE, every key.
  },

  "form": { "sections": [
    { "id": "c1", "role": "head", "bars": 4,
      // NEW (D7) the section's shape and edges; NEW (D5) the within-section
      // sentence (a fields.js PERIODS key). All null = today.
      "intro": null, "env": null, "outro": null, "mot": null, "lvl": null,
      "breath": null, "pipe": null, "nudge": 0, "period": null }
  ] },

  "voices": [
    { "name": "cantor", "kind": "line",
      "cast": { "part": "line", "reg": 0, "entry": 0 },
      // NEW (D5): a string (today) OR { "<secId>": "<cell>", "": "<default>" },
      // resolved by materialAt(). Without it every precomposed record plays one
      // cell for its whole length.
      "material": "psalm",
      "instrument": "tract_voice", "level": 0.15, "set": { },
      "development": { "c1": "as written", "c2": "out" },
      // NEW (D3) — a PARTMIX entry VERBATIM (fields.js:633), every key optional.
      "desk": { "fader": -2.5, "lvl": "back", "pan": "hl",
                "rev": "wet", "echo": "touch", "room": "none",
                "eq": { "lo": 0, "mid": -1.5, "hi": 2 },
                "fx": ["chorus"], "mute": false, "solo": false } }
  ],

  "sound": {
    "level": 1, "synth": null,
    // NEW (D3) — a BUSES value (fields.js:882) and a MASTER value (fields.js:975),
    // VERBATIM. No translation vocabulary exists, on purpose: a second spelling
    // is how "touch" comes to mean 0.12 here and 0.15 there (fields.js:643).
    "buses": { "rev":  { "name": "plate", "ret": "hall", "color": "plate" },
               "echo": { "name": "slap", "time": "d8", "fb": "more", "tone": "dark" } },
    "master": { "drive": "warm", "glue": "glue", "tape": "tape", "space": "room" },
    "fx": ["crunch"]
  },

  "performance": {
    "take": 0, "humanize": 0, "ontime": true,
    // NEW (D7) — the askable.js rows the page has never offered.
    "stress": null,   // 0..1  askable.js:72 "how much does the band lean on the beat?"
    "phrase": null,   // 0..1  askable.js:74 "does the line breathe?" — IT ARCHES
    "touch": null,    // { t, v }
    "orn": null       // an ORN policy object (kernel.js:894)
  },

  // NEW (D4) — producer.js's own note shape (producer.js:1661), untranslated.
  // In the document by the determinism law (songs.js:9-14): a produced record
  // is not reproducible from the axes alone. Absent === [].  NOT a ninth axis.
  "produce": [ { "v": "make", "s": "drums", "d": "punk", "w": 0.64 } ]
}
```

**THE ABSENT-IS-TODAY LAW, for every field added above.** Absence is not a
default written somewhere else; absence is the byte-identical old behaviour, and
it is testable.

| added field | absent means | proved by |
|---|---|---|
| `time.groove` | `setGroove` is never called | D5 fixture: `toGenre(TERMS,i)` deep-equals the frozen pre-move `genreFor(i)` |
| `alphabet.scale` | `scale: mode`, exactly `ui/eight.js:98` | same fixture |
| `voice.material` as a string | the string path, `putPhrase(v*NS+i, ph)` unchanged | same fixture |
| `form.sections[].{intro,env,outro,mot,lvl,breath,pipe,nudge,period}` all null | `emptyBox()` already defaults every one of them to null (`song.js:172`); `derive.js` and `desk.js` already read them | D7 gate assertion 2: velocity spread is 0 with nothing set |
| `voice.desk` absent on every voice | `sec.parts = null` ⇒ `deskUnits` takes the untouched branch | **desk-gate G1** — deep-equal unit tables |
| `sound.buses` / `sound.master` / `sound.fx` absent | `BUSES = null`, `MASTER = null`, `sec.fx = []` — exactly what `push()` produces today | **desk-gate G1** |
| `performance.{stress,phrase,touch,orn}` null | the four `...(P.x != null ? {x:P.x} : {})` spreads emit nothing | D7 gate |
| `produce` absent or `[]` | `run()` returns `secs0` **by reference** (`producer.js:1187`), `bpm` unmoved, `mix` empty | **producer G1** |

### 2.2 THE VIEW MODULE INTERFACE — fixed

Every new file under `nukernel/ui/` that draws implements exactly this, and the
integrator calls nothing else:

```js
/** Draw this module into `parent`. Returns a handle, or undefined. */
export function mount(parent, ctx) -> handle | undefined

ctx = {
  doc(),                      // THE LIVE DOCUMENT — A FUNCTION, never a field.
                              //   eight.js reassigns DOC when the atlas swaps a
                              //   record (eight.js:34 is `let`), so a module that
                              //   captured ctx.DOC would edit a document nobody
                              //   is playing.
  changed(),                  // recompile + redraw — eight.js:251 `push(); draw();`
  redraw(),                   // redraw only
  section(parent, id, title), // -> <section class="nu-ax" id> with a sticky <h2>
  heading(parent, text),      // -> <h3>, appended
  setDocument(next),          // replace the WHOLE record: stop(), DOC = next,
                              //   normalize(), push(true), draw()
  onPos(fn) -> off()          // the beat tick (the existing on("pos") handler,
                              //   eight.js:1104). A module NEVER installs its own
                              //   rAF loop, and audio NEVER calls a view.
}
```

`handle` may carry module-specific methods; only two are called by name —
`atlas.showing(gk)` and `board.paint()`. Four rules come with the interface and
none is negotiable: a view reads globals **only** through `ui/deps.js`
(`deps.js:1-6`, "the SOLE reader of `window.*`") · a view never redraws itself,
`ctx.changed()` owns that, as `select()` does today · every control carries a
unique, **never** index-keyed `dataset.k`, because focus is restored across the
full rebuild by `data-k` (`eight.js:1156`) · `null`/`""`/`false`/`[]` **deletes**
the key, because absent is the only spelling of a default
(`main:nukernel/ui/mixtbl.js:351`).

### 2.3 `nukernel/ui/sheets.js` — the API, fixed

Verbatim from design 02, with one change made here and stated: **the class
names take design 08's `nu-` prefix**, because there is one class vocabulary in
this page and it is §2.4's.

```js
/** One sheet. Returns the <fieldset>, already appended to parent. */
export function sheet(parent, spec) -> HTMLFieldSetElement
/** A row of sheets side by side under one heading. Returns the wrapper <div>. */
export function sheetRow(parent, heading, specs) -> HTMLDivElement
```

| `spec` field | type | meaning |
|---|---|---|
| `key` | string, **unique in the document** | `data-sheet`, the radio `name`, the stem of every `data-k`. Scope-qualified: `key\|voice` or `key\|voice\|sectionId`. A bare key shared by two voices makes two radio groups fight silently. |
| `label` | string | the `<legend>` |
| `options` | `[{ value, label, group, disabled, quiet, why }]` | already resolved by `avail.js`; **pre-sorted**, `sheets.js` never reorders |
| `value` | string \| string[] | compared with `String(v)` |
| `set` | `(value) => void` | called once per gesture, on `change`; never re-enters `sheets.js` |
| `multi` | boolean | checkboxes; `set` receives the whole array |
| `why` | string \| null | sheet-level reason; present ⇒ the `<fieldset>` is `disabled` |
| `ungated` | boolean | no gate row for this key — `data-ungated`, greys nothing |

Option fields: `value` (stringified) · `label` (defaults to value) · `group`
(consecutive options sharing one sit under a `<p class="nu-grp">`) · `disabled`
(blocked — greyed, real `disabled`, `aria-disabled`) · `quiet` (measured inert
here; choosable, class only) · `why`, **required** whenever `disabled` or
`quiet` is set: `sheets.js` THROWS without it, because a silent grey is the bug
this design exists to prevent.

The DOM it emits:

```html
<fieldset class="nu-sheet" data-sheet="dev.line|cantor|c3" data-cols="3">
  <legend>cantor · verse 3</legend>
  <p class="nu-grp">the subject</p>
  <label class="nu-opt is-on" data-v="as written">
    <input type="radio" name="sh:dev.line|cantor|c3" value="as written"
           data-k="opt|dev.line|cantor|c3|as written" checked>
    <span class="nu-w">as written</span></label>
  <label class="nu-opt is-off" data-v="at the fifth">
    <input type="radio" name="sh:dev.line|cantor|c3" value="at the fifth"
           data-k="opt|dev.line|cantor|c3|at the fifth" disabled aria-disabled="true">
    <span class="nu-w">at the fifth</span>
    <small class="nu-why">a pad voices the chord, it does not follow a line</small></label>
</fieldset>
```

A whole sheet off: `<fieldset class="nu-sheet is-off" disabled aria-disabled="true">`
with a `<p class="nu-why">no drummer</p>` and **its options still visible** —
hiding destroys the shape of the possible, which is what a composer reads a
sheet for.

Behaviour, fixed: `set` on `change` only · zero options ⇒ legend plus
`<p class="nu-why">nothing to choose here</p>`, never an empty fieldset ·
duplicate `key` ⇒ `console.error` and a `#2` suffix · `<label>` over a
visually-hidden-but-focusable `<input>` (clip, **never** `display:none`) ·
`sheetRow` returns a `<div>`, because `<fieldset disabled>` disables everything
nested.

**The one law that survives from the parent:** `band-kit.js:3956` — *"THE
STANDING ANSWER IS ALWAYS OFFERED — you can always see the word you are on."*
`optionsFor` clears `disabled` when the option **is** the current value and
appends *", and it is what the record says"*. Without it a loaded document is
un-editable at exactly the moment it matters.

### 2.4 THE DESIGN SYSTEM — one owner, `nukernel/nu.css`

Paul, 2026-08-26: *"Create a simple design system and use plain HTML buttons
where appropriate but bring more consistency."*

**THE AUDIT.** Run on the RENDERED page (chromium at 1280×900 and 390×844,
every tab of both strips clicked, computed styles read back — not read off the
source). 292 interactive elements, and the number of distinct computed **looks**
each kind had before the system was written down:

| element | count | looks | what it is |
|---|---|---|---|
| `input[range]` | 103 | 4 | a quantity |
| `input[radio]` | 48 | 1 | a step in a grid |
| `input[radio]` | 24 | 2 | clipped under a chip on the ring |
| `button` | 41 | 4 | an action |
| `button` | 23 | 2 | a tab |
| `select` | 39 | 2 | a settled choice |
| `input[checkbox]` | 13 | 2 | a switch |
| `select[multiple]` | 1 | 1 | an open choice among many |
| `a[href]` | 0 | — | nothing on the page left it |

…plus the 24 `<label class="nu-opt">` that **are** the widget for the radios
clipped inside them, in 4 looks of their own.

**The intended looks are the ones argued somewhere in `nu.css`; the rest were
accidents, and there were four** — which is what "four different slices" turned
out to mean. Three were visible in the audit itself:

1. a `<button>` inside a `<th>` came out **bold**, because `button { font:
   inherit }` inherits the table header's weight — 8 of the 23 tabs were a
   different button from the other 15 for no reason anybody chose. Fixed by
   `th button, th select { font-weight: 400 }`.
2. a row of buttons was spaced **three ways**: a literal `" "` text node
   (`#tabs`, `#motif-tabs`, the producer's rows), `margin-inline-end: .4rem`
   (`#atlasActs`), and nothing at all. Fixed by one class, `.nu-row`, on the
   container. The text nodes stay — with the stylesheet off they are what keeps
   two tabs from reading as one word.
3. `.is-now`, the page's one spelling of "inverted", **had no writer left**
   while `.nu-circ .nu-opt.is-on` re-declared its two lines by hand. Fixed by
   putting the ring's chosen key on `.is-now`'s own selector list and deleting
   the copy.
4. (found while measuring the other three) `#atlasActs button` restated the
   44px tap floor every button already had **and** carried accident 2's margin —
   one rule doing two things that were both already done. Deleted.

**AFTERWARDS, measured the same way at both widths:** an action is **2 looks** —
the word button, and the icon button whose padding is 2px so seven fit a 390px
line (a named exception, argued where it is written); a tab is **1 look**. Every
other remaining second look is a STATE the browser draws (`:disabled` greys the
border and the face) or the `min-height: auto` a control gets for being a flex
item, which is the same 26×26 box by another name. **Seven kinds, each one look
plus its states.**

**SEVEN KINDS OF CONTROL AND THAT IS ALL THE PAGE NEEDS.** Nothing here is a
new widget; this is what already exists, reduced, with what each is FOR.

| # | kind | what it is | what it is for |
|---|---|---|---|
| 1 | an action | `<button type="button">`, the browser's own chrome, 44px floor | it does something now — play, another take, + line, fork, forget all of it |
| 2 | a tab | the **same** `<button>`, plus `aria-pressed`, the current one wearing `<mark>` | a tab is not a different widget from an action and must not look like one |
| 3 | a settled choice | `<select>` in `.nu-sel` | one value, decided once, nobody browses it |
| 4 | an open choice | `<select multiple>` in `.nu-sheet` — or `.nu-opt` chips over clipped radios where the SHAPE of the field is the point. On the shipped record that second form is the circle of fifths and nothing else (measured: 24 chips, all on the ring), though `ui/sheets.js` still builds one for any single-choice sheet that asks | comparing many musical options at a time |
| 5 | a switch | `<input type="checkbox">` at `--box`, its sentence in the `<label>` | one fact that is on or off |
| 6 | a quantity | `<input type="range">` + `<output>`; 44px in a row, `--cell`-high in a grid | a continuous or ordered number |
| 7 | a step | `<input type="radio">`/`checkbox` at `--box` in a `.nu-grid` cell | one of sixteen — WCAG 2.2's 24px dense-grid floor applies, not `--tap` |

…and **one thing that is not a control at all**: `<a href>`, which until
2026-08-26 the page had none of. A link is the only element here that LEAVES the
page, so it is the only one that keeps an underline (`.nu-wiki`).

**FOUR STATES, and any kind may wear them.** They are adjectives, not widgets:
`.is-on` / `:checked` chosen · `.is-off` / `:disabled` refused (**greyed, never
hidden, reason printed**) · `.is-quiet` inert (`knobs.js`'s `quiet`) ·
`<mark>` / `.is-now` **THE ONE** — the browser's own highlight, reserved for the
sounding step and the tab you are on, which is why `.nu-here` is a rule down the
row and not a tint.

**HOW TO ADD SOMETHING.** If it is one of the seven, use the seven. If it is
not, the burden is to say which of the seven it could have been and why that was
worse, in prose, in `nu.css` — the way every other decision in this codebase is
written down. A slice may not carry its own look; there is no second stylesheet.

#### 2.4.1 THE CLASS VOCABULARY

Verbatim from design 08, plus the names later rounds add. Two state classes are
`is-` prefixed; everything else is `nu-`. **Anything a slice needs that is not on
this list gets added HERE, not declared in a second stylesheet.**

| class | owner of the inside | what `nu.css` guarantees |
|---|---|---|
| `.nu-bar` | shell | sticky `top:0`, z 30, ≥52px, opaque, safe-area padded. **One per page.** |
| `.nu-ax` | shell | the containing block for a sticky `> h2` at `top: var(--bar-h)`, z 20 |
| `.nu-pane` | any | horizontal scroll for exactly ONE table, edge shadows, focusable. **Never nest; never put a sticky heading inside one** — its `overflow-y` computes to `auto`. |
| `.nu-grid` | shell | step-grid table: STEPS RUN DOWN — one row per step, one column per lane (kit) or per question (motif) — 36px cells, centred, sticky first column, a heavier rule every fourth row (`tr.nu-beat`). Rotated 2026-08-25 (Paul: *"Rotate the drum kits and motif editors to be vertical. They'll fit on a phone screen that way"*); it takes no `.nu-pane`, because it no longer overflows. |
| `.nu-hr-deg` `.nu-hr-vel` | shell | the two horizontal sliders in a motif row — 84px and 52px of inline size, 30px tall inside the 36px cell. They replaced `.nu-vr` / `.nu-vr-deg` / `.nu-vr-vel`, the vertical pair, on 2026-08-25 with the rotation. |
| `.nu-sheet` `.nu-opt` `.nu-grp` `.nu-why` `.nu-w` | sheets (D2) | a wrapping row of ≥44px bordered options; `:has(:checked)` reads as chosen |
| `.nu-sel` `.nu-sels` | selects (D2) | a labelled `<select>` and a heading over a row of them — the settled-parameter widget beside the sheet. Added 2026-08-24 (Paul: "We can return some things to select menus … in general where there is ONE option a dropdown is preferred"); it needs almost no rule, because `select{min-height:var(--tap)}` and `label{min-block-size:var(--tap)}` already size and target it. |
| `.nu-board` `.nu-ch` | engineer (D3) | a horizontally scrolling row of channel strips |
| `.nu-eng` | engineer (D3) | the per-voice engineer table inside a voice's sheet |
| `.nu-notes` | producer (D4) | the note-stack table |
| `.nu-map` | atlas (D6) | a full-width, aspect-preserving block `<svg>` |
| `.nu-score` | shell | THE SCORE (2026-08-25, Paul: *"add a section ABOVE motifs which is the current playing music, two measures at a time, but ALL"*) — the `[data-live="score"]` block at the top of Material: a caption and ONE abcjs system, a stave per voice of the record, two measures wide. A rule under it, `contain: layout paint` on the host (true by construction — ui/eight.js gives the host a fixed height and scales the system to fit, so nothing inside it can move the page), and nothing else: it holds no controls, by law. |
| `.nu-tf-row` `.nu-tf` `.nu-tf-was` `.nu-tf-is` `.nu-tf-ref` | shell | THE SEVEN DESIGNING BUTTONS, DRAWN (2026-08-25, Paul: *"'backwards shift left shift right upside down up a step down a step wider' can be icons"*). `.nu-tf-row` is the row and cuts its buttons' padding to 2px so the seven fit one 390px line at ≥44px; `.nu-tf` is the aria-hidden, `pointer-events:none` picture inside each — one shared five-note contour with the operation done to it, `.nu-tf-was` in `--rule` and `.nu-tf-is` in `currentColor` over the `.nu-tf-ref` baseline. **This is the only icon on the page and it narrows rather than repeals Phase 1's "No icons anywhere: words instead"** — those are actions with no visual form, these are geometric operations on a shape you are looking at. The word stays in the DOM as a `.nu-vh` span, so with the stylesheet off the row reads as the seven words in order. |
| `.nu-hint` | any | small dim explanatory text |
| `.nu-here` (on a `<tr>`) | shell | the row you are WRITING, in the form list — a heavy `border-inline-start` on its first cell. **Not `<mark>`**: `<mark>` is the browser's own highlight, the only one this page uses, and in that same cell it already means *this section is SOUNDING* (the playhead writes inside the button). Two facts drawn identically is the conflation 2026-08-24 undid. A rule and not a tint, for the reason the step grid refuses a zebra. Added 2026-08-25. |
| `.nu-row` | any | **a strip of buttons, spaced once** — `display:flex; flex-wrap:wrap; gap:.4em`. One name for what was three ad-hoc spacings (2026-08-26's audit). `.nu-tf-row` restates a tighter `.25em`, because seven 46px icons plus six .4em gaps is 374px against a 366px row and the seven went to two lines — measured. |
| `.nu-wiki` `.nu-kind` | shell | **the article this record IS**, beside `#title` (2026-08-26, Paul: *"add actual Wikipedia links for each genre we have at the top by the title"*). The one `<a href>` on the page and so the one underline; body size and weight, because the record's name is the heading and the article is a footnote to it. `.nu-kind` is a REAL span carrying "the artist" / "the work" / "the broader" for the 31 of 191 rows that are not a genre article — not a `::after`, which a stylesheet-off page cannot print. |
| `.nu-rec` | engineer (D3) | the record-level band under the board — the flow sentence, the character chain, the routing note and the edge list, all facts about the whole record rather than one strip. A top rule and nothing else: a border on four sides would make it look like a third table. |
| `.nu-vh` | any | visually hidden, screen-reader only (lifted from `band.css:60-61`) |
| `.is-now` | any | **the inversion, and its one owner.** `background: var(--ink); color: var(--paper)` — this page's only spelling of "this one is on, and you can see it across the room". 2026-08-26's audit found the name had no writer left in nukernel/ (the playhead says *sounding* with `<mark>`) while the circle of fifths had copied its two declarations out by hand; the ring's chosen key is on this selector now and the copy is gone. |
| `.is-off` | any | **greyed, not hidden.** `.nu-opt:has(:disabled)` gets it free, so a slice only sets `input.disabled = true` and the grey follows. |

Custom properties, fixed: `--tap: 44px` (an isolated control) · `--box: 26px`
(a checkbox or radio) · `--cell: 36px` (one step of a sixteen-step grid) ·
`--bar-h: 52px` · `--head-h: 38px` · `--wash: 4%` (the section colour, §2.4.2). The 36px cell clears WCAG 2.2 AA Target Size
Minimum (24px) — the criterion that exists for dense equally-spaced grids.

#### 2.4.2 A COLOUR PER SECTION

Paul, 2026-08-26: *"Give each section a slightly different color."*

**Which "section".** A record also has sections — head, verse, bridge — and they
are drawn as ROWS of the form list, cells of a voice's table and tiles of the
score ribbon. Colouring **those** is a different feature: they are never blocks
you scroll past, they are already spoken for by the playhead, and a tint on them
would land in the very cells `<mark>` and `.nu-here` share, which is the
conflation 2026-08-24 spent a day undoing. What takes the wash is the seven
`<section>`s a reader scrolls: `#atlas`, the five `.nu-ax` axes, and `#board`.

**It is arithmetic on an index, not a palette.** A section's `--sec` is its
ordinal and the hue is `--sec × 137.5deg` — the golden angle, which is what you
use when you do not know how many you will need. The ladder is written modulo
twelve (`#app > .nu-ax:nth-child(12n+k)`), so a page of thirteen sections does
not run out; the thirteenth reuses the first hue, twelve blocks away. `#atlas`
(0) and `#board` (6) are hand-numbered, because neither is a child of `#app` and
no `:nth-child()` can count them into the run — they take the indices they would
have if the page were one list. That **6** is a number somebody must change if a
sixth axis ever lands, and it is stated rather than engineered around: twelve
golden-angle steps already cover the wheel at ~30°, so beyond twelve blocks some
pair is close whatever the scheme.

**It moves `--paper`, and that is the whole mechanism.** `--paper` has always
meant *the ground you are standing on* — what the sticky `<h2>` paints itself
with, what the pane's scroll-shadow gradients fade to, what a grid's sticky first
column and the circle's face sit on. Redefining it on the section makes all of
those follow with no second rule. `--rule` / `--rule-strong` / `--zebra` are
mixed against `Canvas` and not against `--paper`, so **the wash moves the ground
and never the ink**.

**Measured on the rendered page.** Light: paper goes from `#ffffff` to between
`#fff7f6` and `#fdfdf8`, and CanvasText on the darkest of them is 19.8∶1 (AAA
wants 7). Dark: from `#121212` to between `#191413` and `#181814`, 17.8∶1. Every
rule on the page stays `#9e9e9e`. The farthest two grounds are 11.7 units apart
in sRGB; the nearest ground to `<mark>` is 246 and to `.is-now` 432 — **the tint
cannot be mistaken for a state**. Full-bleed the way `.nu-bar` already does it,
so it reads as ground and not as a box: every section's content box is at the
same x it was and `scrollWidth === innerWidth` at 390 and 1280.

`--wash` goes to `0%` under `prefers-contrast: more` and `forced-colors: active`
— one property, one place. Dark mode needs no query: the mix is against
`Canvas`, which `color-scheme` already swapped. With the stylesheet off the
colour vanishes and nothing is lost, because the wash says nothing the `<h2>`
does not already say in words.

**The same `--wash` dresses the two GROUP columns of the rack board** (bus 3 and
bus 4 — `engine: null` in `fields.js` BUSROWS, no return of their own, their
sends summed into whichever bus they are aimed at). It is painted as a
translucent `linear-gradient` **image** and not a `background-color`, which cost
a measurement: a colour *replaces* the zebra, so the two columns came out a flat
0.96 while their neighbours alternated 1.00 / 0.93 — the columns meant to read
quieter read *lighter* than every other row. An image paints over whatever
background-color the cell already has, so a zebra row under the wash is 0.89 and
a plain one 0.96, both a step darker than the cell beside them.

**The 617px measurement, and what replaced it.** This paragraph read: "The 36px
cell resolves the one real tension, and it is the parent's own answer
(`main:app/daw.css:732-742`): 16×44 = 748px shows 8 of 16 steps on a phone,
16×36 = 617px shows 10 with one swipe." Every number in that was measured and
the conclusion was the best one available to a grid with **steps across**. On
2026-08-25 Paul rotated the grids, and `--cell` keeps its meaning while its
**constraint moves from width to height**: sixteen steps is sixteen 36px ROWS
(576px, down a page that already scrolls that way) and the width is the column
count — the motif grid a fixed **292.8px**, the widest kit the catalog can draw
**272px**, both inside the 296px column a 320px phone leaves. Nothing swipes
sideways and no step grid is in a `.nu-pane`.

**THE FORM IS ONE ELEMENT WITH TWO STATES, AND SO THE NUMBER COLUMN IS NO
LONGER OUT OF BOUNDS.** Paul, 2026-08-25: *"make each section number tappable …
When you click form the list comes back up … Sections are rows / Voices are
tabs."* The form tab is a LIST (one `<tr>` per section: the number as a button,
the name as a `<select>` in the row, the length as text) or a DETAIL (one
section's own questions, replacing the list). The old rule — *a button may not
go in the form table's number column, because those `<th>`s are the playhead's
own live cells and a control inside `[data-live]` is the one thing that must
never happen* — is **answered by nesting, not repealed**: the live `<span>` sits
INSIDE the button, so the clock still writes only inside `[data-live]` and still
writes only text, and `test/motif-frozen.js` A1 ("no control inside a
`[data-live]`") passes unchanged at 390 and 1400.

**FIVE HEADINGS FOR EIGHT AXES, DELIBERATELY.** `8 · Performance` became a TAB
of the band block on 2026-08-25 (*"Why don't you move performance in as a tab
too"*), so the sections in `#app` are `1 · Time`, `2 · Alphabet`,
`3 · Material`, `4–8 · The band` and `9 · The producer`. `4–7` was the first
grouping and this is the second; the grouping follows AXES.md's own SCOPE
column — Performance is song-level, which makes it a peer of `form` and not of
the voices — rather than the enumeration, and the numbers stay in the heading so
the enumeration is still readable through it. Nothing was lost; do not "restore"
eight headings.

**Three failure modes carried forward so nobody rediscovers them:** never write
`overflow-x: hidden` on `body` or `#app` — it kills both stickies silently, and
the sideways scroll is fixed at the table, never at the body; a sticky `<tr>`
does nothing, only cells stick; `--bar-h` is a promise the gate pins.

### 2.5 NEW FILES — one owner each

| file | owner | wave |
|---|---|---|
| `test/soak-nukernel.js` | **crackle** | 0 |
| `nukernel/document.js`, `test/document.test.js`, `test/fixtures/terms-genre.json` | **integrator** | 1 |
| `nukernel/ui/sheets.js`, `nukernel/avail.js`, `nukernel/gates.js`, `nukernel/gates.json`, `nukernel/gates-extract.js` | **sheets** | 2 |
| `nukernel/desk-doc.js`, `nukernel/ui/engineer.js`, `nukernel/desk-gate.js` | **engineer** | 2 |
| `nukernel/precompose.js`, `test/precompose.test.js` | **precompose** | 2 |
| `nukernel/nu.css`, `test/shell.js` | **shell** | 2 |
| `tools/ableton/{donor/Generic.als,donor/README.md,export-als.js,score-node.mjs,als-gate.js}`, `nukernel/export/{als.js,package.json}`, `engine/genres-data.js` | **ableton** | 2 |
| `nukernel/ui/produce.js`, `test/producer-eight.test.js` | **producer** | 3 |
| `nukernel/atlas.js`, `nukernel/atlas-land.js`, `nukernel/ui/atlas.js`, `nukernel/atlas.gate.js`, `scratch/atlas/bake-land.js` | **atlas** | 3 |
| `test/sheets.js`, `test/nudges.js`, `test/atlas.js`, `test/producer.browser.js`, `test/all.js` | **verifier** | 2–3 |

`test/` and `tools/` do not exist on this branch; they are created at the
parent's own paths so the eventual merge to `main` is clean. Data-tier
self-checks stay **beside their data** (`gates-extract.js --check`,
`desk-gate.js`, `atlas.gate.js`) — the precedent `vocabulary.js` set; anything
needing a browser lives in `test/`.

### 2.6 EXISTING FILES — who may edit them, and when

**INTEGRATION FILES — one owner, the integrator, never edited in parallel:**
`nukernel/ui/eight.js` · `nukernel/index.html` · `nukernel/ui/deps.js`. A module
builder that needs a change in these three writes a **recipe** into its slice
note instead — the exact insertion point (`file:line`), the exact lines, the
one-sentence why — and the integrator applies every recipe for a wave in one
serial pass. A builder that edits `eight.js` has broken the round for everybody
else in its wave.

**Everything else, one owner per wave:**

| file | W0 | W1 | W2 | W3 |
|---|---|---|---|---|
| `nukernel/audio/live.js` | crackle | — | engineer (1 line) | — |
| `engine/faust/live/live.js` | crackle (F6 only) | — | — | — |
| `nukernel/audio/desk.js` · `nukernel/audio/plan.js` · `nukernel/fields.js` | — | — | engineer | — |
| `nukernel/fields.js` | — | — | *(engineer)* | **nudges** |
| `nukernel/songs.js` | — | — | **sheets** (WORDGROUP) | **nudges** (5 WORDS rows) |
| `nukernel/genres.js` | — | — | **precompose** (SCALES ×2 **and** the sheets slice's 3 harmony words, supplied by sheets, applied by precompose) | — |
| `nukernel/compose.js` | — | — | precompose (export `ihash`/`rng`) | — |
| `nukernel/vocabulary.js` | — | — | sheets (delete local `evalRule`, require it from `avail.js`) | — |
| `nukernel/producer.js` | — | — | — | producer (H1–H6) |
| `engine/columns.js` | — | — | ableton (`git checkout main -- engine/columns.js`, verbatim) | — |
| `SOURCES.md` | — | — | — | atlas |
| `scratch/play-song.js` | — | integrator (rewrite against `document.js`) | — | — |

`nukernel/songs.js` TERMS gains one deliberate line — `sound.buses.rev.ret:
"hall"` — and it is applied by the **integrator** at the W2 integration step,
not by the engineer, because it is the one edit in the round that changes how
the shipped record SOUNDS and it must land with the readout that explains it.

---

## 3 · THE WAVES

A wave runs fully parallel because its file sets are disjoint. Between waves the
**integrator** applies the recipes to the three integration files and the
**verifier** runs the gates. Neither step overlaps a builder.

### WAVE 0 — THE CRACKLE, alone (D1)

Alone because it is the only wave that touches `engine/`, and because
**everything else in this round is judged by ear through the audio.** Measuring
a sheet, a board or a precomposed record over a stream that drops 583 ms every
eleven minutes proves nothing. The diagnosis is already done — `5a57242`,
2026-08-23, quotes Paul's exact sentence and landed the conceal, the sticky
runway and `underrunShape()`; what remains is that the engine has **no margin**,
the page has **no readout**, and one deployed host serves it un-isolated.

One builder: **F2** (the `health()` export and one `<p id="engine">` readout —
`__nuEngine()` returns six fields while the handle exposes `underrunShape`,
`runwaySec`, `ringDeficit`, `__producer`, `clickMon`, `auditStats`) → **F3**
(`FL.deepRunway = true`, one line before `exploreLive` at `audio/live.js:388`:
the engine's own 8 s response proved itself in both of today's reproductions, it
just arms one audible hole too late) → **F6** (a silent detector is worse than
none: 2 s after `startRun`, push `"clickmon: no readback"` into `errors` if
`rms === 0` — it read 0 through a 583 ms hole) → the gate, which **serves its own
COOP/COEP** (the headers are half of what is under test) and **spawns `--load`
busy cores** (both reproductions needed contention; the idle 2026-08-23 soak
found nothing in the same twelve minutes — *an idle soak is not a gate*).

F1, F4, F5 and F7 are §4. **Done when** the soak exits 0 and the page prints
`stream · runway 8.0s · no dropouts` on an isolated server and the `media (…)`
sentence on one that is not.

### WAVE 1 — THE EXTRACTION, alone (integrator)

`ui/eight.js:75 genreFor` is the document→genre compiler and it lives in a
**view**; `scratch/play-song.js:26` is a second, stale copy. Two owners of one
fact, and three slices below must call it from node. Designs 02 and 05 each
proposed their own extraction (`score.js`, `document.js`); **they are the same
extraction and there is one file** — UMD, node-requirable, no DOM, no `window`:

```js
toGenre(doc, si, GENRES)   // ui/eight.js:75-146, moved VERBATIM
toPhrase(doc, cellName)    // ui/eight.js:162-190, moved VERBATIM
materialAt(voice, secId)   // string | { secId: cell, "": default }  (D5)
barsOf(doc)                // cell steps / stepsIn(meter) — the §2.1 invariant
boxesOf(doc)               // ui/eight.js:216-221, moved VERBATIM
normalize(doc)             // ui/eight.js:492, moved VERBATIM
scoreOf(doc)               // genres + phrases + boxes -> the event list, via NuKernel
```

`ui/eight.js` imports all seven and keeps **zero** copies;
`scratch/play-song.js` is rewritten against it. **Proof of the move, which is
the whole point of doing it alone:** `test/fixtures/terms-genre.json` is a frozen
capture of today's `genreFor(i)` for `songs.js TERMS` at every section index, and
the gate asserts `toGenre(TERMS, i)` deep-equals it. The extraction moved
nothing.

### WAVE 2 — five builders, parallel

| builder | deliverable | new files | existing files it owns |
|---|---|---|---|
| **sheets** | D2 | `ui/sheets.js` `avail.js` `gates.js` `gates.json` `gates-extract.js` | `songs.js` `vocabulary.js` |
| **engineer** | D3 | `desk-doc.js` `ui/engineer.js` `desk-gate.js` | `fields.js` `audio/desk.js` `audio/plan.js` `audio/live.js` |
| **precompose** | D5 | `precompose.js` `test/precompose.test.js` | `genres.js` `compose.js` |
| **shell** | D8 | `nu.css` `test/shell.js` | — |
| **ableton** | D9 | `tools/ableton/*` `nukernel/export/*` `engine/genres-data.js` | `engine/columns.js` |

Disjoint by construction: `ableton` touches nothing any other builder reads,
`shell` writes one new stylesheet, and the other three each own their own corner
of the data tier. Two things this wave settles that its notes could not.
**`gates-extract.js` requires `document.js`** — Wave 1 is why; copying
`genreFor` would create the fourth source of truth `vocabulary.js`'s header
exists to prevent. And **the reverb return**: `audio/plan.js:367` hands
`toEngine` `reverb: 0`, so `rgain = clamp(state.reverb*3.2,0,2)*reverbScale` is
zero, and every unit of the shipped chant carries `rev 0.78` (gregorian's
`tone.verb`, `genres.js:682`) into a muted bus. *78% wet and bone dry.*
`desk-gate` **G6 fails on today's tree**, which is the point of writing it.

**W2 integration** (integrator, serial): the shell's three DOM changes
(`.nu-bar`, `<section class="nu-ax">` per axis, every table in a `.nu-pane`,
`cellpadding`/`cellspacing` attributes off) and the wheel/touchmove cancel on
`anchorWant`; the sheet call sites (16 `<select>`s become sheets; `menuFor`,
`select` and `pick` are deleted); the engineer's four lines in `push()` and its
board block in `draw()`; the `songs.js` TERMS `buses.rev.ret: "hall"` line; the
two comment reversals — `index.html:9-15` and `ui/eight.js:7-9` both currently
say *"No stylesheet is linked and none should be"*, and the house voice records
what forced a decision, so they are **rewritten, not deleted**, quoting Paul's
2026-08-24 sentence and the 375px measurement that made it right.

### WAVE 3 — three builders, parallel

| builder | deliverable | new files | existing files it owns | depends on |
|---|---|---|---|---|
| **producer** | D4 | `ui/produce.js` `test/producer-eight.test.js` | `producer.js` | W1 `document.js` |
| **nudges** | D7 | — | `fields.js` `songs.js` | W2 `ui/sheets.js` |
| **atlas** | D6 | `atlas.js` `atlas-land.js` `ui/atlas.js` `atlas.gate.js` `scratch/atlas/bake-land.js` | `SOURCES.md` | W2 `precompose.js` |

**W3 integration** (integrator, serial): the producer's ninth block at the foot
of `draw()` and its `push()` seam (`GENRES[GK+i] = R.secs[i].genre`, `setBpm(R.bpm)`,
`clearMixOffsets()` + `setMixOffset`); the enriched chairs in `toGenre`
(`reg`, `part`, `pad`, `tone` — without them `touchChairs` rebinds `g.reg` onto
chairs that carry none and `reg(0)` returns undefined after one note, measured);
the nudge sheets in the form tab, the voice tabs and the Performance block, plus
the four `...(P.x != null)` spreads in `toGenre`; the atlas mount above `#app`
(*"a world map on top"*) and `setDocument`.

**One more integrator task in W3, named because it is a live defect precompose
will expose:** `ui/eight.js:40 LANES` names 9 of the 18 lane keys the catalog
uses, and the grid writes `lanes[lane][i] = 1|0` at `:383` — which destroys
velocity-valued lanes (punk's crash lane is `9,…,8`) and drops the sidecars
(`~k ?k !p ~r ~s ?s`). Draw from `genres.js DRUMNAME` and round-trip unknown
keys untouched. Until it lands, a hand touching the kit grid silently flattens
the anchor's kit.

### THE VERIFIER

Its own serial step after each integration. It runs §5's list for the wave, and
it owns `test/all.js` and every browser gate. It reports; it does not fix.

---

## 4 · WHAT IS DEFERRED, AND WHY

Ranked. Nothing here was dropped silently; every line is something a designer
measured and could not finish this round.

1. **F1 — the two nginx headers.** `www.ftrain.com` serves the page with neither
   COOP nor COEP (`curl` shows only `Cache-Control`), so `SharedArrayBuffer` is
   undefined, `exploreLive` throws at `engine/faust/live/live.js:536`, and
   `nukernel/audio/live.js:409-411` demotes to a **different engine** — one with
   no conceal, no counters, and two still-open ENGINE-AUDIT items. Outside the
   repo: an ops line copying `serve.sh:23,28`. Until it lands, D1's readout is
   what tells Paul. `test.stellate.app` IS isolated.
2. **F4 — the per-note channel strip.** `engine/faust/voices/sampler.js:1180`
   builds a whole channel strip PER NOTE: measured on the LIGHTEST record this
   page ships, 164 sampled notes built 164 compressors, 164 shapers, 164
   oscillators, 498 filters and 2,475 gains in twelve minutes — six points of
   keep-up against a 0.92 budget. Deferred because it is the only item in the
   round that can change how a record SOUNDS (a free-running per-voice LFO gives
   each note a different chorus phase) and `mixPCM`, the press twin, must not
   move. Behind ears, next round.
3. **F5 — `eight.js`'s own main thread. MEASURED 2026-08-24, AND IT WAS NOT
   `lightStep`.** This said: *"`lightStep` runs `querySelectorAll` once per
   staff per call, four DOM sweeps a beat. **SUSPECTED only** — the native lane
   measured healthy today (anchors p50 −235 ms). Measure long tasks before
   touching it, or the fix is a guess."* The measurement it asked for was taken
   with a `PerformanceObserver` on `longtask` across two fifty-second runs of
   the shipped chant: **every long task ≥ 100 ms was a `draw()`** — 409 ms and
   436 ms at 390px, 419 ms and 1516 ms at 1400px, one on play and one on each
   section boundary — and the per-beat `lightStep` sweeps produced **none**.
   The item was right to demand the number and wrong about the suspect. What
   the number found was the whole page being rebuilt on the clock, which is
   what Paul had just described from the other side (*"When playing -- Don't
   change motifs visually or change the editing interface. It's too confusing
   when it changes."*); the rebuild is gone as of the two-staves round, the
   gate is `test/motif-frozen.js`, and `lightStep` is left alone — it now reads
   its measure count off the registered entry instead of walking
   `cellOf(cellAt(…))`, which is a tidy, not a fix. **Kept rather than deleted
   because the demand for a measurement before a guess is the part that was
   right.**
4. **Ableton P1–P4.** P0 needs nothing from Paul. P1 (all seats, scenes, project
   zip) and locators need **Ask #1** — one 30-second save with an 8-note clip in
   a slot, a copy in the Arrangement, and one locator, which closes three
   unknowns at once. P2 (samples) needs **Ask #2**. Gate 2 is written so it
   REFUSES `<Locator>` because the donor has none: the failure is the feature,
   and it turns the ask into a mechanical trigger rather than a judgement call.
5. **`tomHi` / `tom` / `tomLo` all export as GM 47.** `to-engine.js:1211-1221`
   builds the drum event from `LANE`, keeps `L.pitch`, drops `L.tom`. One
   additive field fixes it — but the object goes straight to the parent engine,
   so it needs a byte-identity render check. P2's job.
6. **Augmentation and diminution as Development words.** *"stretched out, twice
   as slow"* / *"twice as fast, and twice over"* are implemented in
   `ideas-kit.js:621,645` over a RENDERED phrase and therefore unnameable in
   `WORDS`. **No kernel operator maps step *i* to step *2i*** — `split` changes
   attacks, `del` closes gaps, neither stretches. A builder must not fake it.
   Flagged for the kernel owner.
7. **`bassGrid` has no document slot** — 15 anchors declare one and precompose
   loses it. The shape of the fix is a `{kind:"bass"}` cell; named, not dropped.
8. **`orn` is declared by zero of 122 genres.** `kernel.js:1029 ornament` is a
   complete ninth type with its words already written (`askable.js:78`); D7 gives
   it a sheet. Deciding which music decorates, and how much, is a catalog table
   nobody has written.
9. **The theme composer, and the solo ladder.** `ideas-kit.js` CELLS × CONTOURS ×
   LANDINGS × SENTENCES is a second material model beside eight.js's hand-written
   grid. D5 uses it to WRITE cells; wiring it as an editable surface (PLAN.md's
   MIXED mode, *"THE HAND MOVES LAST"*) is a slice of its own, as is the solo
   ladder (`ideas-kit.js:753`), which needs a taker and a handoff order.
10. **`fitReg`** (`band-kit.js:1379`) moves a seat to the nearest register the
    instrument can hold — measured 19% → 7% of seats out of compass. Precompose
    writes `G.reg(v)` raw. Ten lines against `instruments.js RANGES`.
11. **Bus 3 is not the ping-pong, and neither is bus 4** *(rewritten
    2026-08-26, and the first sentence stands unchanged)*. `pp` is real but it
    is a per-EVENT field and `state-engine.js:2808` stamps it on DRUM events
    only — and its own note adds that it is not sent on SAMPLED drums either
    ("the sampler mix has no pp bus"), which is nearly every kit here. Wiring it
    means editing the parent and re-running its parity gates. What changed is
    the conclusion, not the fact: bus 3 stayed `room` **with no knob of its
    own**, and it turned out to have had one all along. Bus 3 and bus 4 are
    **GROUPS** — no engine accumulator, so their sends are summed into whichever
    bus they are aimed at, and `buses.<bus>.to` is that aim (`fields.js`
    `busRoute`, `audio/desk.js` `feedSplit`). The fold was always a route; it
    just had nobody's hand on it. Homeless beside it: master
    `width`/`tilt`/`ceiling` (`desk.js:769`), which round-trip and draw
    `disabled` with the reason printed, because saying so is cheaper than
    pretending — and **bus 2's return**, which is a compiled slider the parent
    nails to a literal (recipe:
    `bus-2-return-needs-one-line-in-the-parent.md`).
12. **A per-section desk is not expressible.** Right for the document's Sound
    axis today; wrong the first time somebody wants a chorus louder than a verse.
13. **`cast.part` collapses to line/pad.** `eight.js:39` offers seven parts and
    `toGenre` hands the kernel `realize`, never `part`, so a voice the document
    calls a `counter` is addressed `line2` and gets no `PARTS.counter` lean.
    Fixing the name MOVES THE MUSIC (`kernel.js:1387` applies `ctr ±12` and
    `maxHold`). Its own slice.
14. **Two catalogs of place and era.** band-kit's `DECADES` and atlas's `ERAS`
    are two owners of one word list, held together only by gate G5b; band-kit's
    30-record `when/where/venue` table (`band-kit.js:814`) already drifts from
    genres.js's 122 — band-kit says **"Rio"**, genres.js says **"Rio de
    Janeiro"**. The merge is its own job.
15. **F7 — the two open WAV-route audit items.** They only matter if F1 slips;
    that is the route an un-isolated host forces.

---

## 5 · THE GATES

Cheap by construction: the pure-node gates are seconds and run on every wave,
the browser gates run once per integration, and the soak runs at the end of W0
and again at the end of W3. `node test/all.js` runs everything but the soak.

### PURE NODE — structure at the SCORE level

*"Machines verify structure at the SCORE level; ONE run of the relevant gates is
enough."* No DOM, no audio, no browser — each stands the UMD data tier on a stub
window the way `main:test/unit/nukernel.test.js:2688` does (verified working).

| command | what it proves | wave |
|---|---|---|
| `node test/document.test.js` | **the extraction moved nothing** — `toGenre(TERMS,i)` deep-equals `test/fixtures/terms-genre.json` at every section index | 1 |
| `node nukernel/desk-gate.js` | G1 absent-is-today (unit tables deep-equal) · G2 the address is `voiceRoster`'s · G3 every document desk key is a registry key · G4 the rack reaches the state (`d8` → `delay.beats 0.75` in four, `0.5625` in three; `ret:"hall"` → `reverb 0.5` → `rgain 1.6`; `color:"plate"` → `dattorro`) · G5 one owner for the return · **G6 the shipped chant is no longer dry** · G7 the honest master unmoved across 100 drive/glue/tape combinations · G8 the part mix reaches the units and a MODELLED voice has no `sampler` key · G9 solo cuts · G10 the caps hold | 2 |
| `node test/precompose.test.js` | 122 anchors × seeds {1,2,3}, 366 records: no throw · shape against every vocabulary table · **the cell invariant** · **non-silence PER SECTION** · ≥3 distinct cells per record · punk ≠ bossa ≠ chant, named · determinism · the frozen-fixture no-op | 2 |
| `node nukernel/gates-extract.js --check` | re-derives `gates.js` from the running box and exits non-zero if it differs from the shipped file, or if `proofHeld.moved > 0` on any sheet marked `regenerates: true`. **Verified twice, the second time on a holdout** — `vocabulary.json`'s own `arranger/when` depends on `said.drums.kit`, which is the coincidence a single fit produces. | 2 |
| `node tools/ableton/als-gate.js /tmp/n.als --genre boombap` | Gate 0 well-formed + every pointee id unique + `NextPointeeId` > max · Gate 1 round-trip, **asking the SONG not the XML** (multiset of `(MidiKey, Time, Duration, Velocity)` per clip, plus the totals) · Gate 2 donor conformance, which **must fail on `<Locator>`** · Gate 3 sample audit + the `/Users/ford` M4L warning | 2 |
| `node test/producer-eight.test.js` | G1 no notes is byte-identical (`secs` by reference) · G2 every offered sentence moves · **G3 every reachable stack is PLAYABLE** by `dice.test.js:50-73`'s own predicate, over 5 rungs + 200 random stacks · G4 undo is exact · G5 grids monotone · G6 the hand wins (`HELD`) · G7 the offering agrees with the mover · G8 the cast is the document's · G9 every word came from a table | 3 |
| `node nukernel/atlas.gate.js` | G1 all 122 keys in exactly one of `WHEN`(116)/`EXCLUDE`(6) · G2 re-extract the regex and deep-equal the committed `WHEN` · G3 every place resolves through `ALIAS`, no orphans · G4 coordinate bounds · G5 `YEARS` is 65, 600..2013; G5b band-kit `DECADES` a subsequence of `ERAS` · G6 every one of the 65 slider stops has ≥1 exact record · G10 Britain reports 0 dot-pairs under 26 units | 3 |

### HEADLESS BROWSER — read the RENDERED output

*"TEST THE ARTIFACT: gates must read the rendered output; three features shipped
broken while every check passed."* All borrow playwright:
`NODE_PATH=/home/ford/ftrain-2025/node_modules`, with an **explicit**
`executablePath` — `chromium.launch()` resolves shell build 1200, which is not
installed on this machine; the builds that exist are
`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` and
`chromium_headless_shell-1234/...`. Target `http://localhost:8777/nukernel/index.html`.

| command | what only a browser can prove | wave |
|---|---|---|
| `node test/shell.js` | `scrollWidth === clientWidth` at 320/375/430/820 · zero `button`/`select`/`input[type=number]` under 44px · every checkbox and radio ≥24px both axes · every `.nu-pane` has `scrollHeight − clientHeight ≤ 1` · every `<table>` has a `.nu-pane` parent · at scrollY 600/1400/2400 the `.nu-bar` is at 0 and **exactly one** `.nu-ax > h2` sits in `0 < top < 120`, and it is the axis the viewport is inside · `.nu-bar` height equals `--bar-h` · after `pane.scrollLeft = 200` the sticky lane `th` moved ≤2px | 2 |
| `node test/sheets.js` | `#app select` is empty · `.nu-opt` count per sheet equals `NuAvail.SHEETS[key].values(...).length` · exactly one `input:checked` per non-multi sheet · **NO SILENT GREY**: every `input:disabled` has non-empty `.nu-why` text and every `fieldset[disabled]` a non-empty `> .nu-why` · the three named gates end to end (untick drums → `dev.kit` reads *no drummer*; harmony modal → `alphabet.quality` reads *modal harmony has no changes*; a `pad` voice → `at the fifth` disabled while `out` is not) · ArrowDown moves the value AND `activeElement.dataset.k` · with `document.styleSheets[0].disabled = true` all of it still holds and every `.nu-why` string is in `body.innerText` | 2 |
| `node test/nudges.js` | with `env:"arch"` on section 2 the box carries the key AND the rendered events show `max(vel) − min(vel) ≥ 2`, and `= 0` with nothing set (kernel numbers measured: 64 flat vel-5 events → `3 4 4 5 5 5 5 4`) · **THE GREY-OUT GATE**: on a document with no drums voice, `outro: fill\|roll\|tomfill\|hatrun\|doubles\|break` and `intro: kit` are `disabled` and nothing else is; add a drums voice and all seven come alive · zero `pageerror` | 3 |
| `node test/producer.browser.js` | three real taps → `window.__eightProd()` shows the note with a non-empty `said` · the compiled bar the ENGINE is handed changes, measured off the `audio/plan.js` timeline · *"take it off"* restores it byte-identical | 3 |
| `node test/atlas.js` | G7 all non-`localhost:8777` requests aborted, no `pageerror`, exactly 62 `.dot` and 62 `.hit` circles and `LAND.length` paths · G8 set `#atlasYear` to `indexOf(1969)`, click Kingston's rendered `cx/cy`, `#title` becomes `Kingston 1969` within 3 s with the five `h2` headings intact · G9 the same click twice gives identical `__eightDoc()`, *"another take"* differs · G11 the fallback listbox gives the same document · G12 tap boxes ≥28 CSS px at 390×844 in the world view, ≥44 in Britain · G13 a swipe on the SVG still scrolls the page · G14 no performance entry names another host | 3 |
| `node test/soak-nukernel.js --mins 12 --load 2` | serves its OWN COOP/COEP, spawns 2 busy cores, clicks `#play`, polls `__nuEngine()` every 5 s. Non-zero exit unless `isolated && ring` · `starve.episodes === 0` · `keepUp` p05 ≥ 0.92 · `clickMonAlive && clicks === 0` · `anomalies === 0` · end heap ≤ 1.25× minute-2 heap · zero console errors and zero `pageerror`s · `producer.peak ≤ 3.0` | 0, again at 3 |

### PAUL'S EARS — the backstop, and the only judge of these

1. **The deep runway (F3).** It trades up to ~5 s of extra heard-lag on any
   walk-fed change — a genre change, a tempo edit, a section rewrite — for a
   buffer that does not empty. The fader is unaffected; it rides the master gain
   outside the ring (`live.js:2068`). If the lag is wrong, **5 s is the retreat,
   not 3 s.** A gate cannot decide this.
2. **The reverb return, opened.** Every genre in the catalog defaults its section
   send to `tone.verb`, so the moment a return opens, wetness that was silently
   discarded becomes audible. The chant will not sound like it did yesterday, on
   purpose. Does it sound like a stone room?
3. **~~`fx` back on a track~~ — ANSWERED, 2026-08-26, and the answer was no.**
   The ask stood here: *"`fx` back on a track reverses a quoted directive (Paul,
   2026-08-17: 'get rid of inserts, reverb, and echo — let me send to bus 1, bus
   2, and bus 3 instead'). The argument is that the premise changed — the sends
   are wired to real returns now, so a chip is only for what must be IN the
   path. This needs Paul's nod, not a gate's."* He gave the opposite: *"Don't
   let me add effects to instruments. That's bus and board stuff. But let me
   have up to four buses and a way to direct them to each other."* The chip is
   off PARTMIX and off every surface; the measurement that made the argument (an
   insert costs a MULTIPLE, a bus costs a CONSTANT) is now the reason there is a
   fourth bus. `desk-gate` G14 holds it: no per-voice effects control anywhere
   on the rendered page, and no field left for one to write.
4. **`--cell: 36px`.** It clears WCAG AA but not the 44px Apple figure. If the
   thumb disagrees on a real phone the answer is one custom property — and since
   the rotation of 2026-08-25 the cost is a taller block rather than a second
   swipe per bar, because sixteen steps is sixteen rows. Do not build a toggle.
5. **The `IDIOM` table.** Ten family rows and ~20 anchor overrides are a taste
   claim, and they will be wrong for some anchors. The gate prints which family
   row each anchor resolved to; the review that adds rows reads that print-out.
   Does a punk hook sound like punk?
6. **62 hand-typed coordinates.** G4 catches a city in the sea; it cannot catch
   one 200 km off. One human pass over the rendered world view is required and is
   named here as such.
7. **Gate 4 — Live.** Only Live proves a set opens. The CLI's last line is the
   ask: `open "<path>" in Live 12.4.3 and say whether it opens`. This is the
   LIVE-gate law, which `verify.sh` has always missed.
8. **The stylesheet off.** With `document.styleSheets[0].disabled = true` the
   page must still read as the same document, top to bottom. That is the promise
   the CSS reversal is allowed to make.
