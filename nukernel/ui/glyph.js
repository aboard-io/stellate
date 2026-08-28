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
  tab: {
    Where:   { g: "⊕", w: "Where",
               s: "the globe and the when-slider — where and when the record comes from" },
    Tempo:   { g: "♩", w: "Tempo",
               s: "how fast it counts, how a bar is divided, and how it swings" },
    Key:     { g: "♯", w: "Key",
               s: "the key, the mode and the changes" },
    Motif:   { g: "♬", w: "Motif",
               s: "the motifs — the little tunes and beats the record is built from" },
    Band:    { g: "☰", w: "Band",
               s: "the form, the players, and what each one plays in each section" },
    Mix:     { g: "⇅", w: "Mix",
               s: "the board — a strip per voice, then the bus series, then main" },
    Produce: { g: "✦", w: "Produce",
               s: "the producer — a step through genre space, and what it moved" },
    Score:   { g: "𝄞", w: "Score",
               s: "the record as notation and as a piano roll" },
    Export:  { g: "⇩", w: "Export",
               s: "a link, a .wav, a .mid — the record out of the box" },
  },

  /* THE TRANSPORT. `play` and `stop` are ONE button in two states and the word
     on it is still "the NEXT tap" (ideal/composer.html annotation 5) — the
     mark moves with the word, so ■ means "stop it" exactly as the word did.
     `take` is a die because a take IS the dice: the transport's own sentence
     for it is "a take is a seed — the hand moves, no chosen note does".
     `rewrite` is the repeat mark, and it is the one glyph on the page with a
     number BESIDE rather than INSIDE it — `#reading` is a separate <b> and
     stays exactly where it was. */
  act: {
    play:    { g: "▶", w: "play",
               s: "play the record from the top" },
    stop:    { g: "■", w: "stop",
               s: "stop the record" },
    rewrite: { g: "↻", w: "rewrite",
               s: "write the record again from the same place, on a new seed" },
    take:    { g: "⚄", w: "take",
               s: "the same record, played again — a new roll of the hand's dice" },
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
export function paintIcon(b, opts) {
  const word = opts.word == null ? "" : String(opts.word);
  const want = opts.on ? "MARK" : "SPAN";
  b.setAttribute("aria-label", word);
  if (opts.say) b.dataset.say = opts.say; else delete b.dataset.say;
  if (opts.on != null) b.setAttribute("aria-pressed", String(!!opts.on));
  const had = b.firstElementChild;
  if (had && had.tagName === want && b.dataset.face === opts.glyph + "|" +
      (opts.num == null ? "" : opts.num) + "|" + word) return b;
  b.dataset.face = opts.glyph + "|" + (opts.num == null ? "" : opts.num) + "|" + word;
  b.textContent = "";
  const box = el(opts.on ? "mark" : "span", null, "nu-ic");
  const g = el("span", opts.glyph, "nu-g");
  g.setAttribute("aria-hidden", "true");
  box.append(g);
  if (opts.num != null) box.append(el("span", String(opts.num), "nu-n"));
  box.append(el("span", word, "nu-vh"));
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
  let x = Math.round(r.left + r.width / 2 - w / 2);
  x = Math.max(6, Math.min(x, vw - w - 6));
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
