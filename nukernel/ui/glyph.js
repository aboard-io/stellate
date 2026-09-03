// nukernel/ui/glyph.js — THE ONE TABLE OF MARKS, AND THE ONE EXPLAINER.
//
// Paul, 2026-08-28: *"Please make all the tabs and top buttons into sensible
// icons to save space. Voice 2 for example could be more symbol plus the
// number 2. Provide a simple long tap or hover tooltip to explain what they
// are."*
//
// WHY THIS FILE EXISTS AT ALL, and it is the one-owner law rather than a
// preference. Before today the page had ONE glyph table — `KINDGLYPH` in
// ui/eight.js, three characters keyed by a voice's kind — and its own comment
// warned about the last time somebody copied it ("that fix left a second table
// behind it … which is the drift this file spends its comments warning
// about"). ui/engineer.js read that warning and obeyed it the only way it
// could from another module: it REFUSED the glyphs and drew the board's tabs
// as words ("THE GLYPHS STAY IN eight.js … copying three characters here would
// be that drift again"). Paul has now asked for glyphs on every tab row on the
// page, in four different files, so the table has to be reachable from all of
// them. It is EXTRACTED, not copied: `KINDGLYPH` is gone from ui/eight.js and
// its three characters are the `kind` column below, unchanged. Two of the
// other marks were extracted with it — `FORMGLYPH` (▦) and `PERFGLYPH` (◈),
// which were two constants beside it for the two song-level tabs.
//
// AND IT HOLDS THE SENTENCES TOO. A glyph that a person cannot read is a
// control with no name, so every mark below ships with the WORD it stands for
// and one CLAUSE of what the tab holds. The word becomes the button's
// `aria-label` and its `.nu-vh` text; the clause becomes what the explainer
// says. One row, three columns, one owner — a renamed tab is renamed in the
// strip, in the screen reader and in the popover by being renamed here.
//
// ===== THE REVERSAL, WRITTEN IN PLACE ====================================
// nukernel/ideal/design-system.html has said since it was painted: *"No
// tooltips. A tooltip is information hidden from a finger. Anything worth
// saying is on the page; anything not worth the space is deleted."* That law
// is REWRITTEN THERE (voice rule 5, dated 2026-08-28) rather than deleted,
// because its reasoning is what tells you how to honour it and Paul's ask at
// the same time. The objection was never to the EXPLANATION; it was to the
// HOVER — a mouse-only gesture on a page whose reader has a thumb. So:
//
//   · HOVER opens it for a mouse. Not `title`: the native tooltip never fires
//     on touch at all (which is the law's own complaint, in the browser's own
//     implementation) and takes about a second to appear on a desktop.
//   · LONG-PRESS opens it for a thumb, 450ms, with the same words. Nothing is
//     hidden from a finger.
//   · THE POPOVER IS NOT A CONTROL. It holds no button, no link and no focus;
//     it is `role="tooltip"`, it is pointed at by `aria-describedby` while it
//     is open, and it is `hidden` the rest of the time — so the text diet
//     never counts it and a screen reader never meets it twice.
//   · IT DOES NOT MOVE THE PAGE. `#nu-say` ships in nukernel/index.html as the
//     last element of <body>, outside `#app` and outside every `[data-live]`
//     subtree, and it is `position: fixed` — it is POSITIONED, never inserted
//     into flow, so opening one cannot reflow a row under a thumb.
//   · ESCAPE CLOSES IT, and so does the next press anywhere. That press is
//     otherwise ordinary: long-press a tab to learn what it is, tap it to open
//     it. Only the press that OPENED the popover is swallowed, so a long-press
//     never doubles as an activation.
//
// WHAT IS STILL TRUE OF THE OLD LAW, and this is why it is a rewrite and not a
// repeal: nothing that a reader NEEDS is in here. Every button that carries a
// mark also carries its full word in `aria-label` and in a `.nu-vh` span, so
// with the stylesheet off this page still reads as the same document it always
// did, and a screen reader hears "Where", never "circled plus". The popover
// adds a clause of context to a control that already names itself. A REFUSAL
// still keeps its sentence ON the page (`data-why`, printed, ui/selects.js) —
// no reason ever moves in here.

/* ---------- the local kit ------------------------------------------------ */
const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n; };

/* ===== THE TABLE =========================================================
   Three columns per mark: the GLYPH, the WORD it stands for, and one CLAUSE
   of what is behind it. A row with no clause is a mark whose word is the whole
   story (a voice's kind, the two views of the deck) and the caller supplies
   the sentence — see `sayVoice` and `sayBus` below.

   THE GLYPHS ARE UNICODE CHARACTERS AND NOTHING ELSE. No icon font, no CDN, no
   SVG sprite: the offline law is the whole of this page's claim, and a glyph
   is text — it inherits the ink, it scales with the type, it survives forced
   colours with no media query, and it costs no request. Every one of them was
   rendered in this browser before it was chosen and not one of them is tofu
   (measured 2026-08-28: 37 candidates, 0 fallback boxes).

   ...AND THEY ARE ONE HAND. `system-ui, "Segoe UI Symbol", "Noto Sans Symbols
   2"` — the same stack `.nu-tf` already sets for the transform rows, for the
   reason written there: "a serif ↕ next to a sans ↑ is two different arrows,
   and the page's own face is not guaranteed to have any of them." */
export const GLYPH = {
  /* THE VOICE KINDS — ui/eight.js `KINDGLYPH`, moved here whole on 2026-08-28
     and not otherwise touched. Its own note, kept: "The glyphs used to be
     keyed by NAME, from when the voices were called line/pad/bass/drums — so a
     LINE named 'bass' drew the bass mark. A name is the composer's; a kind is
     the machine's." Keyed by kind, still. */
  kind: { line: "♪", bass: "▼", drums: "◉" },

  /* THE TWO SONG-LEVEL TABS INSIDE THE BAND — ui/eight.js `FORMGLYPH` and
     `PERFGLYPH`, moved here whole. Their note, kept: "the form tab is not a
     voice … and neither is performance … ◈ beside ▦, from the same geometric
     family, because what those two have in common is that nobody plays them." */
  song: {
    form:        { g: "▦", w: "form",
                   s: "the sections, their bars, and the questions each one answers" },
    performance: { g: "◈", w: "performance",
                   s: "the take, the humanising, and whether the band plays dead on the grid" },
  },

  /* THE NINE, IN PAUL'S ORDER (his list of 2026-08-27). The WORD column is the
     same nine words and ui/eight.js `TABS` is still their owner — this table
     is keyed BY that word, so a tab renamed there and not here draws no mark
     rather than the wrong one, which is the failure that can be seen.

     WHY EACH MARK IS THE ONE IT IS, because a picture nobody can argue with is
     a picture nobody can correct:
       Where   ⊕  a globe: a circle with its meridian and its equator
       Tempo   ♩  the beat itself — the ♩ in "♩ = 120"
       Key     ♯  a key signature, which is what this panel sets
       Motif   ♬  two notes beamed: a little tune, which is what a motif is
       Band    ☰  three rules, one per player — the stack of voices the band
                  block draws down its left edge. There is no menu anywhere in
                  nukernel for a hamburger to be confused with; grep answers 0.
       Mix     ⇅  two faders, one up and one down — the board is a wall of them
       Produce ✦  the producer's touch: the one panel that is a hand on the
                  record rather than a control on it
       Score   𝄞  the clef. Nothing else on this page is as unmistakably "the
                  written music", and the deck's own two views take the ruled
                  paper (▤) and the roll (▥) below it, so the clef is free.
       Export  ⇩  out of the box and onto your disk */
  /* THREE ROWS ADDED 2026-09-02, AND ONE DEBT PAID (the composer round).
     Paul: *"I click the genre, it starts to play, and there's a new view: A
     genre editor appears. This is the 'Rules' section; it'll need a new icon
     in the left nav."* and *"Sections/Structure has the same challenges …
     It should be top level, not buried under band, and below band."*
       Rules      §  the section mark — a rule of law is a §, and these are
                     the record's own rules read as sentences. Nothing else in
                     this table uses it.
       Structure  ▦  the same ▦ `GLYPH.song.form` and `GLYPH.sec.list` already
                     wear, because it is the same fact one scope up ("the same
                     fact wears the same mark"): the sections ARE the structure.
       Video      ▣  the debt this table named on 2026-09-01 ("Video is not in
                     this table and draws the '•' fallback"), paid. A framed
                     square is a screen; ▦ is spent on the form, and ▣ is its
                     filled-centre sibling — a picture inside a frame rather
                     than a grid. */
  tab: {
    /* RULES (2026-09-02). Paul, 2026-09-01: *"there's a new view: A genre
       editor appears. This is the 'Rules' section; it'll need a new icon in
       the left nav. The genre data is expressed as logical sentences and rules
       derived from the data in the genre."* § is the section sign — the mark
       that has meant "a numbered clause of a text you may cite and amend"
       since the glossators, which is exactly what a rule is here: a sentence
       with a threshold in it that you can edit. It is not ≡ (that is a list),
       not ⚙ (that is settings, and `act.opts` takes it below), and not ⚖ (a
       balance is a judgement; these are declarations). */
    Rules:   { g: "§", w: "Rules",
               s: "the genre as sentences you can edit" },
    Where:   { g: "⊕", w: "Where",
               s: "the globe and the when-slider — where and when the record comes from" },
    Rules:   { g: "§", w: "Rules",
               s: "the genre as sentences — the rules this record was written from" },
    Tempo:   { g: "♩", w: "Tempo",
               s: "how fast it counts, how a bar is divided, and how it swings" },
    Key:     { g: "♯", w: "Key",
               s: "the key, the mode and the changes" },
    Motif:   { g: "♬", w: "Motif",
               s: "the motifs — the little tunes and beats the record is built from" },
    Band:    { g: "☰", w: "Band",
               s: "the form, the players, and what each one plays in each section" },
    /* STRUCTURE (2026-09-02). Paul, 2026-09-01: *"Sections/Structure has the
       same challenges … It should be top level, not buried under band, and
       below band. Bring performance into structure."* ▦ is the ruled block,
       and it is ALREADY this page's mark for a section: `sec` below uses it
       for add/move/cut, and `facet.sections` uses it for "per-section". A tab
       that holds the sections wearing the same mark its own rows wear is the
       one-owner law working — a reader learns the picture once. `song.form`
       carries ▦ for the same subject and is not a tab. */
    Structure: { g: "▦", w: "Structure",
               s: "the sections, and every question per section per player" },
    /* THE CLAUSE MOVED WITH THE VOICES, 2026-08-28. It read "the board — a
       strip per voice, then the bus series, then main"; the strips are inside
       the voices now (Paul: "remove the voices from the mixing board and just
       put them as nav items in the voices themselves"), so what this tab holds
       is the series and the automation grid. The MARK does not move: it is the
       voice's `mix` facet's mark too, one scope down. */
    Structure: { g: "▦", w: "Structure",
               s: "the sections, the grids, and how the record is performed" },
    Mix:     { g: "⇅", w: "Mix",
               s: "the bus series — genre fx, delay, reverb, main — and the " +
                  "section automation grid" },
    Produce: { g: "✦", w: "Produce",
               s: "the producer — a step through genre space, and what it moved" },
    Score:   { g: "𝄞", w: "Score",
               s: "the record as notation and as a piano roll" },
    Video:   { g: "▣", w: "Video",
               s: "the record as a film — the deck's own picture" },
    /* Screensaver (2026-09-01, "Bring back the screensaver from stellate as a
       new view like the video view"): ✷ is a star with rays — the old star
       map's whole subject — and ✦ was already spent on Produce. (This said
       "Video is not in this table and draws the '•' fallback; that is its own
       open ask." The ask is CLOSED, 2026-09-02: `tab.Video` is one row up.)

       2026-09-02 — THE SUBJECT CHANGED AND THE GLYPH DID NOT. Paul:
       "screensaver is just a bunch of stars. It should be the little aliens
       dancing, not the infinite wandering." The sentence below is rewritten
       because it is user-visible prose that had gone false; ✷ stays, because
       the stars stay (faint, behind the floor) and because a reader finds this
       tab by its mark. The old sentence, for the record: "the star map as a
       screensaver — the record's sky, drifting with the bars". */
    /* VIDEO (2026-09-02) — AND THIS CLOSES THE DEBT THE PARAGRAPH ABOVE
       NAMES. The Video tab shipped on 2026-09-01 with no row here, so
       `paintTray` drew the "•" fallback: a naked dot in a stripe where every
       other mark is a picture of its subject. ▣ is a frame with a filled
       centre — a screen with a picture in it — and it reads as the sibling of
       ▦ (the ruled block, Structure) and ▥ (the roll) at 1.2rem, which is
       the family this tab belongs to: it is the record's FORM, shown as
       moving pictures. ▶ was not available (it is `act.play`, and a tab that
       looks like the transport is the confusion the transport's own glyph
       note is written to avoid). */
    Video:   { g: "▣", w: "Video",
               s: "the film, cut to the record's own sections" },
    Screensaver: { g: "✷", w: "Screensaver",
               s: "the little aliens dancing — one per player, hopping on its own notes" },
    Export:  { g: "⇩", w: "Export",
               s: "a link, a .wav, a .mid — the record out of the box" },
  },

  /* THE TRANSPORT. `play` and `stop` are ONE button in two states and the word
     on it is still "the NEXT tap" (ideal/composer.html annotation 5) — the
     mark moves with the word, so ■ means "stop it" exactly as the word did.

     ===== THE TWO MARKS WERE ON THE WRONG BUTTONS, 2026-08-28 ==============
     Paul: *"At the very top, switch the seed and dice icons — wrong icons for
     what they do."* They are swapped here, in the one table, and the argument
     this paragraph used to make is kept beside its correction because the
     argument was RIGHT and it was pointed at the wrong control.

     WHAT IT SAID: "`take` is a die because a take IS the dice: the transport's
     own sentence for it is 'a take is a seed — the hand moves, no chosen note
     does'. `rewrite` is the repeat mark." Every clause of that is true of the
     WORD "dice" and false of the button it was painted on:

       · REWRITE IS THE THROW. It bumps the atlas's seed and composes the
         record again from the same anchor — `genreToDocument(gk, seed)` — so
         every decision in the document is rolled fresh: other motifs, other
         changes, another band. That is a throw of the dice, and it is the one
         gesture on this page where a number you cannot predict decides what
         the record IS. ⚄.
       · TAKE IS THE RETAKE. It bumps `DOC.performance.take`, which "reaches
         the engine and not the model — a take cannot move a DECISION": the
         same record, the same notes, the same band, played round again by a
         hand that lands differently. That is a second pass at a fixed thing,
         which is what ↻ has meant since it was a repeat mark on a stave. ↻.

     Said the shortest way: the dice change WHAT is played, the cycle plays the
     SAME thing again — and the page had it exactly backwards, so a reader
     learning the strip from its pictures learned the two verbs the wrong way
     round. The words, the sentences and the two `aria-label`s did not move an
     inch; only the pictures did, which is the whole point of the marks and
     their words being one row in one table.

     `rewrite` is still the one glyph on the page with a number BESIDE rather
     than INSIDE it — `#reading` is a separate <b> and stays exactly where it
     was, and ui/eight.js still hand-paints that button around it. */
  act: {
    play:    { g: "▶", w: "play",
               s: "play the record from the top" },
    stop:    { g: "■", w: "stop",
               s: "stop the record" },
    rewrite: { g: "⚄", w: "rewrite",
               s: "write the record again from the same place, on a new seed" },
    take:    { g: "↻", w: "take",
               s: "the same record, played again — a new roll of the hand's dice" },
    /* THREE MORE, 2026-09-02 (the composer round). `opts` pays the debt
       nu.css named at `#playops` ("A PICTURE FOR IT IS OWED and it wants a row
       in ui/glyph.js `GLYPH.act`"): ⚙ is the gear every platform spells
       settings with, and #playops was the one mark in the gutter that was a
       word because it had no picture. `seed` is the SAME ⚅ the rewrite
       gesture wears, under the word the foot now prints on it — one node, one
       id, two names: the GESTURE's ("rewrite 5", what a screen reader is told
       and what eleven gates call it) and the SUBJECT's ("seed", what an eye
       reads under the die). `tap` is the tap-tempo mark the Tempo panel takes
       in the next wave. */
    opts:    { g: "⚙", w: "opts",
               s: "play options — the mode, the take, the voices and the room" },
    /* ...AND THE WORD IS NO LONGER ON THE FACE, 2026-09-03. Paul: *"just get
       rid of the word seed and put the number."* The number stands where the
       word stood (`#seedval`, its own target, beside the die), so ui/eight.js
       still builds the `.nu-vh` span out of `w` — the page reads as itself
       with the stylesheet off, test/shell.js A6g/A6h — and nu.css hides it for
       this one mark. `w` therefore stays what it always was, the subject's
       name, in the table where the page's names live; the sentence is the
       explainer the die carries as `data-say`, and it named a slider that no
       longer exists. */
    seed:    { g: "⚄", w: "seed",
               s: "tap for another reading of this record — a new number, " +
                  "the same place" },
    tap:     { g: "⏱", w: "tap",
               s: "tap a tempo and the record counts what you tapped" },
  },

  /* THE BUS SERIES, IN THE ENGINE'S OWN ORDER. The board numbers these 1..4 —
     genre fx → delay → reverb → main — so the mark says WHICH KIND of stage
     and the digit says WHERE in the chain, which is the same sentence a voice
     tab makes. The words themselves are NOT here: ui/engineer.js reads them
     off the fields.js registry (`busLabel`), because "a renamed row is renamed
     on the tab by existing", and that is still true. */
  bus: {
    genre: { g: "✳", s: "the genre's own effects — the first stage every strip feeds" },
    echo:  { g: "⋯", s: "the delay bus — the echoes, and their bleed into the reverb" },
    rev:   { g: "≋", s: "the reverb bus — the room the whole record sits in" },
    main:  { g: "◎", s: "main — where the series ends and the record leaves" },
  },

  /* THE ONE MOVE THAT IS NOT A SIBLING (2026-08-28). Paul: *"There should be
     one vertical stripe max with an 'up' icon to get to the parent level."*
     The tray draws ONE level at a time, so every other mark in it is a
     CHOICE AMONG SIBLINGS and this one is a change of level — a different
     kind of action, which is why nu.css puts a rule between it and them.
     ↑ and not ← : the levels of this page are a hierarchy and hierarchy reads
     upward; ← is the word for "the page before this one", which is the back
     button's, and a control that looked like the back button and was not one
     is the confusion this glyph is chosen to avoid. It is the same arrow
     `.nu-tf` already sets in the same hand (system-ui, Segoe UI Symbol, Noto
     Sans Symbols 2) so the two never read as two different arrows. */
  /* ===== TOMBSTONE: THE ↑ HAS NO CALLERS, 2026-09-02 ====================
     REVERSED by Paul, the composer round: *"We should never need the 'up'
     icon because we can expand multiple levels of interface option."* The
     gutter is a TREE now — several branches stand open at once and the way
     back out of one is folding it, which is the same mark you opened it with.
     `trayUpBox`, the head signature and every construction of this row are
     deleted from ui/eight.js; `sayUp()` below has no callers either.
     THE ROW STAYS, EMPTY OF CALLERS, because the paragraph above it is the
     argument for ↑ over ← and is worth keeping where the picture is: if a
     future stripe ever needs a non-sibling move, this is the mark and this is
     why it is not an arrow pointing left. Nothing on the page draws it. */
  nav: {
    up: { g: "\u2191", w: "up" },
  },

  /* THE FOOT OF THE GUTTER — THE LOGGER (2026-08-28). Paul: *"Add a logger on
     the bottom right. Log actions. … Badge the logger with the number of lines
     it holds."*

     `¶` AND NOT A FOURTH BOX OF RULES. The page already spends three marks on
     stacked lines and every one of them means something else: ☰ is the band
     (three rules, one per player), ▤ is ruled paper (the staff), ▥ is the roll.
     A fourth box of rules in the same 47px column would be the drift this file
     exists to stop — four pictures nobody could tell apart, all of them "lines".
     The pilcrow is the only mark in common type that means LINES OF WRITING
     rather than lines of music or lines of players: it is the typographer's
     "a new entry begins here", which is exactly what one log line is.
     IT IS ALSO THE SAFEST MARK IN THE TABLE. `¶` is U+00B6 — Latin-1, in every
     face that can draw this page's own text, so it is the one glyph here that
     cannot be tofu even before the `system-ui, Segoe UI Symbol, Noto Sans
     Symbols 2` stack gets a turn.

     THE COUNT IS THE `num` COLUMN, which is the gutter's own idiom and not a
     new one ("the mark says the KIND, the digit says WHICH" — a voice tab is
     ♪ over 2). Here the digit says HOW MANY, drawn by the same `.nu-n` span in
     the same place, tinted by nu.css so it reads as a badge rather than as an
     index. Nothing new is spelled. */
  log: { g: "¶", w: "log",
         s: "what the box has done — every change you made, newest first, and "
          + "what the engine says about the sound" },

  /* ===== TOMBSTONE: THE ? ROW THIS TABLE WAS OWED, AND WILL NOT GET =====
     ui/explain.js carried its own three columns — `{ g: "?", w: "explain", s:
     … }` — as a literal beside its only caller, with a note saying the row
     "belongs in ui/glyph.js's GLYPH table, the one owner of what a gutter
     button is" and was left there only because that file was outside its
     round's fence. The debt is CLOSED by deletion rather than by payment:
     Paul, 2026-09-02, *"Get rid of explain — that's the genre editor's work
     now."* The ? mark, its panel and its module are gone; the genre editor is
     the Rules TAB, whose row is `GLYPH.tab.Rules` and is already here.
     WRITTEN DOWN SO NOBODY PAYS IT LATER. A future hand reading explain.js's
     note in the history would add a `?` row to a table nothing draws — which
     is how a deleted feature comes back one column at a time. `log` above is
     untouched and is not the same kind of thing: it says what a HAND did, not
     what a record IS. */

  /* THE SECTIONS, THE VOICES AND THE TEMPO, AS LEVELS OF THE GUTTER
     (2026-08-28). Paul, in one batch: *"Make the sections into nav items with
     the ability to add them and remove them and recharacterize and move them
     up and down"*, *"Make a new voice section for all voices"*, *"When I'm in
     tempo, move the tempo nav to the right nav."*

     NOT ONE NEW PICTURE WAS INVENTED FOR THE OPERATIONS. Every mark below is
     either a glyph this table already ships or a PAIR of them, concatenated
     the way `motifOpsTrayItems` already concatenates a transform's two-glyph
     face: the SUBJECT first, then what is being done to it. So `▦↑`
     is "this section, upward" and `▦×` is "this section, gone" —
     read left to right, in the same order the words are said. The alternative
     was three more arrows in a table that already spends four marks on arrows
     (↑ up, ⇩ export, ⇅ mix, ↓ slower), which is the drift
     this file exists to stop.

     × IS U+00D7, THE MULTIPLICATION SIGN — Latin-1, like ¶ above, so
     it is one of the two marks here that cannot be tofu in any face that can
     draw this page's own text. It is NOT the letter x and it is not ✕:
     a remove button is the one control in the gutter that must never be
     mistaken for a letter of somebody's section name.

     THE FACETS OF A VOICE were Paul's own three sentences about what a voice
     IS ("Instrument voice with settings from the mixer / What it plays,
     register, material / Per-section settings"), and there are FOUR marks
     since 2026-08-28, when he split the first sentence in two: *"In the voice
     -- add another nav item for the mixing and give it a channel design like
     the mixer … add it in a new nav element called mix that is per voice."*
       ◍  the driver seen end-on — what this voice IS: its instrument, its
             machine, its throat
       ⇅  two faders, one up and one down — what is DONE to it: the channel
             strip. It is the Mix tab's own mark said one scope down, which is
             this table's standing idiom (`per-section` wears the form's ▦ for
             the same reason): the same fact wears the same mark, whether you
             meet it as a record-level tab or inside one player.
       ♫  two notes: what it PLAYS — its part, its register, its default
       ▦  the sections again, because "per-section" is the form seen from
             inside one player, and the same fact wears the same mark. */
  sec: {
    list: { g: "\u25a6", w: "sections",
            s: "every section of the record, by name — tap one for its own questions" },
    one:  { g: "\u25a6", w: "section" },
    add:  { g: "+\u25a6", w: "+ section",
            s: "another section, added after the one you are in" },
    up:   { g: "\u25a6\u2191", w: "move up",
            s: "this section trades places with the one before it" },
    down: { g: "\u25a6\u2193", w: "move down",
            s: "this section trades places with the one after it" },
    drop: { g: "\u25a6\u00d7", w: "remove",
            s: "this section leaves the record, and every word keyed to it goes with it" },
  },

  /* WHAT A VOICE IS, IN THREE FACETS (see the paragraph above). */
  facet: {
    /* THE CLAUSE ON `inst` LOST ITS SECOND HALF, 2026-08-28, WITH THE STRIP.
       It read "what this voice is, what is on it, and where it sits — the
       whole strip", written the night the strip was a row on this facet. The
       strip is the `mix` mark below now, so the clause says what is left. */
    inst:  { g: "\u25cd", w: "instrument",
             s: "what this voice is — its instrument, its machine, and its throat" },
    mix:   { g: "\u21c5", w: "mix",
             s: "this voice's channel strip — its inserts, its sends, its tone, " +
                "where it sits and how loud" },
    plays: { g: "\u266b", w: "what it plays",
             s: "its part, its register, when it comes in, and the motif it reads by default" },
    sec:   { g: "\u25a6", w: "per-section",
             s: "what this voice reads and does, section by section" },
    /* THE FIFTH MARK, AND IT IS A WAVEFORM (2026-09-03). Paul, 2026-09-01:
       *"I can't really access or organize samples used in, say, San Francisco
       1996. They aren't accessible to the app in any way."*

       `\u223f` IS THE ONLY MARK IN COMMON TYPE THAT MEANS A RECORDING. Every
       other candidate was a fifth box of rules in a table that already spends
       four marks on boxes (\u25a4 the staff, \u25a5 the roll, \u25a6 the
       sections, \u25a3 the film) — "four pictures nobody could tell apart",
       which is the drift the paragraph at `sec` above exists to stop. A sample
       is not a box of anything; it is one waveform, and U+223F SINE WAVE draws
       exactly that.
       IT IS NOT \u224b, AND THE DIFFERENCE IS THE SUBJECT. `\u224b` is the
       reverb bus — three tildes, a room's reflections, many. This is ONE
       continuous wave: one recording, played once.
       RENDERED BEFORE IT WAS CHOSEN, which is this table's own rule
       (2026-09-03, this page's font stack in headless chromium: 33.5px against
       the 24.0px tofu box, so it is a real glyph and not a fallback square).

       ONE ROW, TWO SCOPES, which is this table's standing idiom said at `mix`:
       *"the same fact wears the same mark, whether you meet it as a
       record-level tab or inside one player."* ui/eight.js draws it as a child
       of Band (the whole record's crate, `bandsamples`) and as a facet of one
       member (that player's own files, `facet-samples`) — one picture, one
       word, two depths. */
    samples: { g: "\u223f", w: "samples",
               s: "every recording this plays \u2014 the file, the loop points, " +
                  "and a way to put another in its place" },
  },

  /* THE DECK'S TWO VIEWS, DELIBERATELY A PAIR: one box of rules laid the way
     each view lays its time. ▤ is ruled paper — the staff, which runs across.
     ▥ is the roll — blocks standing up the pitch axis. Turn one and you have
     the other, which is exactly what the two buttons do. */
  view: {
    not:  { g: "▤", w: "notation", s: "the record engraved, as it would be printed" },
    roll: { g: "▥", w: "piano roll", s: "the record as blocks — pitch up, time across" },
  },
};

/* THE VOICE'S OWN MARK. `kindOf` is a function and not a table lookup here
   because only the caller knows what a name IS on its strip: ui/eight.js's
   band row has two song-level tabs in front of the voices and a voice may
   legally be CALLED "form" (see SONGTABS). A kind this table does not know
   draws the fallback dot, which is what `KINDGLYPH[...] || "•"` did. */
export const kindGlyph = (kind) => GLYPH.kind[kind] || "•";

/* WHAT A VOICE TAB SAYS WHEN YOU HOLD IT. The number on the tab is the voice's
   place in the RECORD's roster (`doc.voices`), and it is that in both rows
   that draw it — the band's `#tabs` and the board's `#boardtabs` — so "voice
   2" means one player wherever you are looking. (The board's own channel walk
   orders lines, then bass, then drums, and drops a kit that is not hired; if
   the number were read off THAT list, the same player would be 2 on one screen
   and 3 on the other. It is read off the roster in both.) */
const KINDWORD = { line: "a line", bass: "the bass", drums: "the kit" };
export const sayVoice = (name, kind, n, of) =>
  name + " — voice " + n + " of " + of +
  (KINDWORD[kind] ? ", " + KINDWORD[kind] : "");

/* ...AND WHAT `\u2191` SAYS, WHICH IS WHERE IT TAKES YOU FROM. The word on the
   button is always "up" — one verb, so a person who has learned the stripe
   once has learned it everywhere — and the CLAUSE names the level you are
   leaving, because "up" on its own is the one label that cannot say what it
   does. It is a function and not a table row for the reason `sayVoice` is:
   only the caller knows which level is open. */
/* ...AND WHERE IT GOES IS AN ARGUMENT NOW (2026-08-28). The gutter grew a
   third depth — root, the motif bank, this motif's operations — the day Paul
   asked for it: *"When I'm in a motif, the motif operations should be the
   right nav elements on the view. The up arrow to take me home should take me
   back to the motif picker."* So "back to the nine tabs" stopped being true of
   every `↑` and became the DEFAULT of one that is not told otherwise. The verb
   is still "up", one verb at every depth; what varies is the clause, and the
   clause is the whole reason this is a function. */
export const sayUp = (parent, back) =>
  "up \u2014 out of " + parent + ", back to " + (back || "the nine tabs");

/* ...AND WHAT THE LOGGER'S MARK SAYS, WHICH IS HOW MUCH IS IN IT (2026-08-28).
   Paul: *"Badge the logger with the number of lines it holds."* The badge is
   the digit; this is the same number said in words, because a badge is a
   picture and `aria-label` may not be one. It is a function and not a table
   row for the reason `sayUp` is: only the caller knows the count.

   AND THE RESTING STATE IS SAID, NOT DRAWN AS A ZERO. A gutter mark wearing a
   `0` is a control announcing that it has nothing — furniture that costs a
   glance every time your eye goes down the stripe. So the badge is ABSENT at
   nought (ui/eight.js passes `num: null`) and the NAME carries the fact for
   anyone who asks: "log — nothing yet". */
export const sayLog = (n) =>
  n ? "log \u2014 " + n + " line" + (n === 1 ? "" : "s")
    : "log \u2014 nothing yet";

/* ===== THE BUTTON ========================================================
   ONE SPELLING, FIVE ROWS. Every strip of tabs on this page is already "a
   <p class="nu-row"> of plain buttons carrying `aria-pressed`, the open one
   wearing a <mark> and the shut ones a <span>" — four files say that sentence
   about each other. This is that button with a face on it, so the fifth
   spelling nobody wanted is one function instead.

   WHAT IS IN A BUTTON, and every part of it is load-bearing:
     <button aria-label=WORD data-say=CLAUSE data-k=KEY>
       <mark|span class="nu-ic">
         <span class="nu-g" aria-hidden="true">GLYPH</span>   the picture
         <span class="nu-n">2</span>                          the number, if any
         <span class="nu-vh">WORD</span>                      the word, still here
       </mark|span>
     </button>

   `aria-label` AND THE `.nu-vh` WORD ARE BOTH REQUIRED AND THEY ARE NOT A
   SECOND OWNER: they are one string, from the table above, in two places that
   answer two different questions. Without the label the accessible name would
   be assembled from the CONTENT — "black down-pointing triangle 2 bass" — and
   a screen reader must not be read an emoji. Without the `.nu-vh` word the
   page would stop reading as itself with the stylesheet off, which is the
   claim nukernel/index.html makes in its first paragraph.

   THE GLYPH IS `aria-hidden` AND `pointer-events: none` (nu.css), both for the
   reasons `face()` in ui/eight.js already gives: it is decoration beside a
   word that is the real name, and the BUTTON is the tap target — "a mark
   inside it that could take the press is the half-hour the globe round lost to
   a decorative stroke swallowing every tap."

   THE NUMBER IS THE ONLY TEXT THAT SHOWS. Paul: "Voice 2 for example could be
   more symbol plus the number 2." The mark says the KIND, the digit says
   WHICH — and a digit needs no translating, which is the whole reason it is
   the one thing left visible. */
export function icon(opts) {
  const b = document.createElement("button");
  b.type = "button";
  if (opts.k) b.dataset.k = opts.k;
  paintIcon(b, opts);
  return b;
}

/* REPAINT IN PLACE, AND ONLY WHEN THE SHAPE ACTUALLY CHANGES. Three rows call
   this on every switch to move one <mark>; `paintTabs` in ui/eight.js has
   always short-circuited when the wrapper is already the right tag and that
   test is kept here, so a tab switch still writes two attributes and nothing
   else on eight of the nine buttons. */
/* ...AND A MARK THAT CANNOT BE PRESSED SAYS WHY, ON ITSELF (2026-08-28).
   The gutter grew a level of ACTIONS the day the tempo operations moved into
   it, and an action is the one kind of mark that can be impossible: there is
   no bpm below 40, no section above the first, no way to remove the only
   section a record has. The page's standing law is that a refusal carries a
   MEASURED reason and that the reason is never silent — ui/selects.js throws
   on a grey option with no `why`, and `tempoRow` (whose buttons these now are)
   spelled it exactly this way before the row moved:

     · `disabled` + `aria-disabled`, so the browser refuses the press;
     · `data-why`, so a gate reads the reason back off the RENDERED artifact
       rather than off a spec (test the artifact, this box's own law);
     · the reason JOINED TO THE ACCESSIBLE NAME, because a screen reader that
       announces "half the tempo, dimmed" and nothing else is the silent grey
       in another medium.

   It is EXTRACTED here rather than copied into ui/eight.js: this file is the
   one owner of what a gutter button is, and `tempoRow`'s four lines were the
   fifth spelling that owning it prevents. A mark with no `why` is untouched —
   `removeAttribute` on both, so a level repainted in place (`paintTray`'s
   short-circuit) cannot leave a stale refusal on a button that is live again
   because the tempo moved. */
export function paintIcon(b, opts) {
  const word = opts.word == null ? "" : String(opts.word);
  const want = opts.on ? "MARK" : "SPAN";
  const why = opts.why == null ? "" : String(opts.why).trim();
  b.setAttribute("aria-label", why ? word + ", " + why : word);
  if (why) { b.disabled = true; b.setAttribute("aria-disabled", "true");
             b.dataset.why = why; }
  else { b.disabled = false; b.removeAttribute("aria-disabled");
         delete b.dataset.why; }
  if (opts.say) b.dataset.say = opts.say; else delete b.dataset.say;
  if (opts.on != null) b.setAttribute("aria-pressed", String(!!opts.on));
  const had = b.firstElementChild;
  // ...AND THE SIGNATURE CARRIES THE REFUSAL (2026-08-28). It was glyph|num|
  // word, which was exact while every mark was pressable; a refused mark and a
  // live one are the same three strings, so a level repainted in place after
  // the tempo moved off a bound would have kept the old ink. (The two
  // attributes above are written on every call either way — this guards only
  // the DOM rebuild — but the signature must still move, or `.nu-ic` would
  // never repaint for a state change that is genuinely visible.)
  /* ...AND THE SECOND LINE, 2026-09-02 (the composer round). Paul: *"On the
     nav I need to know what they're playing as instruments."* A tree row says
     two things now — WHO ("cantor") and WHAT ("church organ", "8 bars ·
     drive", "Kingston 1969") — and the second is a `sub` line under the word,
     dim, one line, ellipsised. It is a THIRD member of the face signature
     rather than a fourth channel: the sub is drawn from the same table the
     word comes from, it is never a second copy of anything, and a row whose
     instrument changed under a repaint-in-place must rebuild or the line goes
     stale (which is exactly the bug the signature exists to prevent).
     IT IS NOT IN THE ACCESSIBLE NAME. `aria-label` stays the WORD (plus a
     refusal's reason), because "cantor, church organ" read out on every arrow
     key is a name that grew a description — and the description is already in
     `data-say`, which the hold explainer speaks. The three-part body
     (glyph · number · word) is untouched, so A6h and gutter T10 still find the
     `.nu-vh` word they read. */
  const sub = opts.sub == null ? "" : String(opts.sub).trim();
  const sig = opts.glyph + "|" + (opts.num == null ? "" : opts.num) + "|" +
              word + "|" + (why ? "no" : "") + "|" + sub;
  if (had && had.tagName === want && b.dataset.face === sig) return b;
  b.dataset.face = sig;
  b.textContent = "";
  const box = el(opts.on ? "mark" : "span", null, "nu-ic");
  const g = el("span", opts.glyph, "nu-g");
  g.setAttribute("aria-hidden", "true");
  box.append(g);
  if (opts.num != null) box.append(el("span", String(opts.num), "nu-n"));
  box.append(el("span", word, "nu-vh"));
  if (sub) box.append(el("span", sub, "nu-sub2"));
  b.append(box);
  return b;
}

/* ===== THE EXPLAINER =====================================================
   ONE LISTENER SET FOR THE WHOLE PAGE, delegated off `document`, so a row that
   grows a tab grows an explainer by saying `data-say` and nothing else. Five
   rows and four files share it; none of them installs a handler of its own.

   THE PRESS THAT OPENS IT IS THE ONLY PRESS THAT IS SWALLOWED. `armed` is the
   element a long-press fired on; the very next `click` from it is eaten (in
   the capture phase, before the row's own handler) and the flag is cleared.
   Every later press is ordinary — it closes the popover on the way down and
   then does whatever it was always going to do. Long-press to learn, tap to
   open, and no gesture ever means two things at once.

   THE 450ms AND THE 10px ARE THE PLATFORM'S OWN NUMBERS, not chosen here:
   450ms is between iOS's touch-and-hold (~500ms) and Android's long-press
   (~400ms), and 10px of slop is what both call the difference between a hold
   and a scroll. A hold that turns into a drag is a SCROLL and must not open
   anything, which is why `pointermove` past the slop cancels — this page has
   lost a round to a control that ate a scroll before ("when I touch them I
   scroll the whole window and can't interact").

   AND IT NEVER MOVES THE PAGE. `#nu-say` is `position: fixed`, so it is out of
   flow: nothing above the thumb reflows when it opens, and `showTab`'s scroll
   promises are untouched. It is clamped into the viewport rather than allowed
   to overhang, because a fixed box that hangs off the right edge is a page
   that scrolls sideways on some engines and A1 is the law this page has paid
   for most often. */
const HOLD_MS = 450, SLOP = 10;
let say = null, openOn = null, timer = 0, armed = null, downAt = null;

const box = () => {
  if (!say) say = document.getElementById("nu-say");
  return say;
};

function place(el2) {
  const n = box();
  if (!n) return;
  const r = el2.getBoundingClientRect();
  n.hidden = false;
  n.style.left = "0px"; n.style.top = "0px";     // measure unclamped
  const w = n.offsetWidth, h = n.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  /* CLAMPED TO THE CONTENT COLUMN, NOT TO THE VIEWPORT (2026-08-28). One edge
     of this page is a fixed gutter (`#nu-tray`, nu.css THE TAB ROW BECAME A
     GUTTER) and Paul's rule for it is *"Dont let anything go under it."* A
     popover explaining a mark IN the gutter would otherwise sit on top of the
     gutter and cover the marks either side of the one it is about. So the box
     stops at the gutter's inner rule and opens away from it, which is also the
     only side there is room on.

     ...AND IT NO LONGER KNOWS WHICH EDGE THAT IS, 2026-08-28. This read
     `const right = tr.left` and clamped to it — one number, hard-coded to a
     gutter on the RIGHT. Paul moved it the same afternoon: *"Move the right
     nav to the left so it doesn't interfere with the scroll on the right."*
     With the stripe at x=0 that arithmetic clamped every popover to
     `0 - w - 6`, a negative left, and `Math.max(6, …)` then pinned all of them
     to x=6 — under the gutter, which is the exact failure the clamp was
     written to prevent. So the rectangle is MEASURED and the side is read off
     it: whichever edge the stripe is against, the popover's range stops at its
     inner rule. Nothing here has to be edited if it moves again, which is why
     nu.css's own list of what follows the gutter names this function as the
     one entry that needs no pass.
     Read off the element rather than off the token, for the reason it always
     was: a page with no tray — or a stylesheet that has been turned off — must
     still clamp to the viewport, which is what this does when it finds
     nothing there. */
  const tray = document.getElementById("nu-tray");
  const tr = tray ? tray.getBoundingClientRect() : null;
  let lo = 6, hi = vw - 6;
  if (tr && tr.width && tr.left < vw && tr.right > 0) {
    if (tr.left <= 1) lo = Math.max(lo, tr.right + 6);        // against the start
    else if (tr.right >= vw - 1) hi = Math.min(hi, tr.left - 6);  // against the end
  }
  let x = Math.round(r.left + r.width / 2 - w / 2);
  x = Math.max(lo, Math.min(x, hi - w));
  /* UNDER THE CONTROL IF THERE IS ROOM, OVER IT IF THERE IS NOT — and under
     first, because on a phone the thing being held is under a thumb and the
     thumb is below it. */
  let y = Math.round(r.bottom + 6);
  if (y + h > vh - 6) y = Math.max(6, Math.round(r.top - h - 6));
  n.style.left = x + "px";
  n.style.top = y + "px";
}

export function showSay(el2) {
  const n = box();
  if (!n || !el2 || !el2.dataset.say) return;
  n.textContent = el2.dataset.say;
  place(el2);
  el2.setAttribute("aria-describedby", "nu-say");
  openOn = el2;
}

export function hideSay() {
  const n = box();
  if (openOn) openOn.removeAttribute("aria-describedby");
  openOn = null;
  if (n) { n.hidden = true; n.textContent = ""; }
}

const target = (e) => (e.target && e.target.closest)
  ? e.target.closest("[data-say]") : null;
const clear = () => { if (timer) { clearTimeout(timer); timer = 0; } downAt = null; };

let wired = false;
export function wireSay() {
  if (wired) return;
  wired = true;
  /* HOVER, FOR A MOUSE, AND ONLY FOR A MOUSE. `pointerover`/`pointerout`
     bubble (`pointerenter` does not) so one pair of listeners covers every row
     on the page, and `pointerType` is what keeps a touch from opening the
     popover twice — a tap fires a compatibility `pointerover` on the way in on
     both engines. */
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = target(e);
    if (!t) return;
    if (t !== openOn) showSay(t);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = target(e);
    if (t && t === openOn) hideSay();
  });
  /* …AND A HOLD, FOR A THUMB. */
  document.addEventListener("pointerdown", (e) => {
    clear();
    /* THE NEXT PRESS CLOSES IT, WHEREVER IT LANDS — INCLUDING ON THE CONTROL
       IT IS EXPLAINING, which is the case this line exists for. It read
       `if (openOn && openOn !== t)`, and that left the popover standing after
       the second tap on the same tab: measured 2026-08-28 at 390 with a real
       touch sequence — hold Where (opens), tap Where (the tab opened, the box
       stayed up). "A second tap closes it" has to mean the tap you actually
       make, so it closes on any press.
       IT DOES NOT SWALLOW THAT PRESS: only the click from the press that
       OPENED the popover is eaten, and `armed` is the whole of that. So the
       gesture is hold-to-learn, tap-to-open, in two taps and not three. */
    if (openOn) hideSay();
    const t = target(e);
    if (!t || e.pointerType === "mouse") return;
    downAt = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = 0;
      armed = t;
      showSay(t);
    }, HOLD_MS);
  }, { passive: true });
  document.addEventListener("pointermove", (e) => {
    if (!timer || !downAt) return;
    if (Math.abs(e.clientX - downAt.x) > SLOP ||
        Math.abs(e.clientY - downAt.y) > SLOP) clear();
  }, { passive: true });
  document.addEventListener("pointerup", clear, { passive: true });
  document.addEventListener("pointercancel", () => { clear(); }, { passive: true });
  /* THE ONE SWALLOWED PRESS, in the CAPTURE phase so the row's own click
     handler never runs. A long-press must not also open the tab it explained. */
  document.addEventListener("click", (e) => {
    if (!armed) return;
    const t = target(e);
    armed = null;
    if (t && t === openOn) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openOn) hideSay();
  });
  /* A SCROLL MOVES THE CONTROL AND THE POPOVER IS FIXED, so it would sit over
     the wrong thing. It closes rather than chases: a box that follows a scroll
     is a box that is still moving after the gesture, and this page has spent
     rounds on exactly that. */
  addEventListener("scroll", () => { if (openOn) hideSay(); }, { passive: true });
  addEventListener("resize", () => { if (openOn) hideSay(); });
}

/* A GATE IS A HAND (ui/eight.js's own phrase for `window.__eightTab`). These
   two are the same door for a probe that cannot hover and cannot hold. */
window.__nuSay = (sel) => {
  const t = typeof sel === "string" ? document.querySelector(sel) : sel;
  if (t) showSay(t);
  const n = document.getElementById("nu-say");
  return n && !n.hidden ? n.textContent : null;
};
window.__nuSayOff = () => { hideSay(); return !!(box() || {}).hidden; };
