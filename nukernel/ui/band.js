// nukernel/ui/band.js — THE BAND: an arranger and two players. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const Band = window.NuBand;
const { blank, catalog, say, says, toSong, seatDecisions, nextAsk, nextAnywhere,
        answer, SEATS, sectionAsks, setSection } = Band;
import { GENRES, NuSong, MODES } from "./deps.js";
import { adoptSong, SONG, SLOTS, putPhrase, on, commit, setBpm, setSwing, setPoolChair,
         setMixOffset, clearMixOffsets } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt,
         announceChange } from "../audio/live.js";
import { registerSW, warmCache, warmShell, warmed } from "../audio/offline.js";
import { toABC, toNotes } from "./abc.js";
import { playAudition, stopAudition, auditioning, zoneFilesFor } from "../audio/audition.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GKP = "lab.band.";           // one session genre per section of the form
const MELP = "lab.idea.";          // ...and the melody's own, when somebody takes it
const VOXP = "lab.voice.";         // ...and the singer's, which is a layer too
let cells = [];                    // the pattern's cells, for the playhead
let asking = null;                 // a decision being revisited, if any
let model = blank();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes
let seat = "arranger";             // who you are talking to
let ledger = [];                   // what has been said, in order
let section = null;                // a section being arranged, if any
const said = new Map();            // subjects you have answered, and with what

/* ---------- the model reaches the engine ---------- */
// the kit becomes a GENRE (kit.js toGenre) installed in the live table, and
// the song is four bars of it — which is every mechanism the engine already
// has for drums and no new one.
let ver = 0;
let settling = false;              // a first-push replacing the whole record:
                                   // the auto-start listens for ANSWERS, not
                                   // for the count-in or the reset landing
// LIVE WHILE EDITING. With a lane pinned you are placing hits one at a time,
// and waiting out a four-bar form to hear each one is the difference between
// an instrument and a form. So the loop SHORTENS to one bar while a lane is
// open — the same engine, the same kit, the bar you are working on coming
// round every couple of seconds — and the whole four-bar form (with its
// fills) comes back the moment you close the lane.
function push(first) {
  settling = !!first;
  const song = toSong(model, MODES);
  song.forEach((s2, i) => { GENRES[GKP + i] = { ...s2.genre, __v: ++ver }; });
  // any genre from a longer previous form must stop being referenced
  for (let i = song.length; i < 24; i++) {
    delete GENRES[GKP + i]; delete GENRES[MELP + i]; delete GENRES[VOXP + i]; }
  // THE ONE ENTRANCE CARRIES A SKELETON; THE RECORD LANDS IN PLACE.
  // adoptSong validates a DOCUMENT, and this page's four phrase banks
  // (pattern/guitar/melody/voice per section) outgrow the daw document's
  // ceiling (fields.js NSLOTS) the moment a form has five sections — and a
  // form's "build"/"break" are this page's role words, not the loader's. A
  // full-record adopt was therefore REFUSED for a big roll, silently: SONG
  // kept the old record while GENRES already held the new one, and the
  // first compile across that seam read a section whose genre had been
  // swept (the dice found it — band-page.test.js crashed on the roll). So
  // the adopt does only the job `first` exists for — the session reset:
  // board, groove, pool, pins, typed errors still honest — carrying a
  // minimal legal skeleton, and the record itself always arrives the way
  // an answered question already arrives: in place, below.
  if (first) adoptSong({ v: NuSong.VERSION, bpm: model.song.bpm, genres: {},
    slots: [song[0].pattern],
    song: [{ ...NuSong.emptyBox(), stack: [{ g: GKP + 0, slots: [0] }],
             len: song[0].bars }] }, "band");
  setBpm(model.song.bpm);
  setSwing(model.song.swing || null);
  setPoolChair("bass", model.bass.instr);
  // the keys player sits in whichever chair their JOB names — the pool casts
  // by role, which is exactly what a part is
  // the pool casts by ROLE, and two chairs can want the same role — the one
  // whose part it actually is wins, and the guitar's roles are its own
  const kj = Band.Ky.JOBS[model.keys.job] || {}, gj = Band.Gt.JOBS[model.guitar.job] || {};
  for (const chair of ["pad", "stab", "riff", "counter", "line", "drone", "lead"]) {
    const mine = gj.part === chair ? model.guitar.instr
      : kj.part === chair ? model.keys.instr : null;
    setPoolChair(chair, mine);
  }
  // THE ENGINEER'S HAND ON THE DESK. Everything the fourth chair decides is
  // a mix OFFSET (ui/state.js MIXER, applied in audio/desk.js over the
  // composed mix), so the engineer needs no audio path of its own — it is
  // the same board the mixer page writes. Cleared and rewritten whole on
  // every push: what the engineer said IS the board on this page.
  clearMixOffsets();
  for (const [chan, vals] of Object.entries(Band.mixOf(model)))
    for (const [k, v] of Object.entries(vals)) setMixOffset(chan, k, v);
  // THE KEYS PLAYER'S PHRASE, per section: a pitched voice is a part and a
  // PHRASE, and only the phrase says where the hands fall. One slot per
  // section, so a chorus can comp while the verse holds pads.
  // THREE BANKS OF PHRASES, one per pitched thing: the keys, the guitar and
  // whatever melody is being picked up. derive.js walks phrase pi to voice
  // pi, so the order of a box's slots IS the order of its chairs.
  const NS = song.length;
  song.forEach((s2, i) => { putPhrase(i, s2.pattern); putPhrase(NS + i, s2.guitar); });
  for (let i = NS * 4; i < SLOTS.length; i++) putPhrase(i, NuSong.blank());
  // ...and the bank is exactly four per section, no holes: the skeleton
  // adopt starts it at one phrase, and a section without a melody or a
  // voice must still leave a blank where its slot would be
  for (let i = 0; i < NS * 4; i++) if (!SLOTS[i]) putPhrase(i, NuSong.blank());
  // ...and the MELODY is a layer of its own, with its own genre and its own
  // phrase: a two-bar tune cannot ride the bar clock the rhythm section
  // keeps (the kernel reads a phrase's own length AS the bar), so it gets a
  // stack entry rather than a voice.
  song.forEach((s2, i) => {
    if (!s2.melody) { delete GENRES[MELP + i]; }
    else { GENRES[MELP + i] = { ...s2.melody.genre, __v: ++ver };
           putPhrase(NS * 2 + i, s2.melody.phrase); }
    // ...and the singer, on a layer of their own for the same reason
    if (!s2.voice) { delete GENRES[VOXP + i]; }
    else { GENRES[VOXP + i] = { ...s2.voice.genre, __v: ++ver };
           putPhrase(NS * 3 + i, s2.voice.phrase); }
  });
  const boxes = song.map((s2, i) => ({ ...NuSong.emptyBox(),
    stack: [{ g: GKP + i, slots: [i, NS + i] },
            ...(s2.melody ? [{ g: MELP + i, slots: [NS * 2 + i] }] : []),
            ...(s2.voice ? [{ g: VOXP + i, slots: [NS * 3 + i] }] : [])],
    len: s2.bars, role: s2.role, cue: s2.role,
    // ...and the engineer's hand on THIS section: the box's own strip
    ...(s2.box || {}) }));
  // the form can change length, so the box list is replaced in place —
  // every push, `first` included (its adopt carried only the skeleton)
  SONG.length = 0; for (const b of boxes) SONG.push(b);
  commit("box"); commit("swing");
  commit("transport");
  settling = false;
  // ONCE THE RECORD IS CALLED, IT IS YOURS: the samples this cast can ask
  // for are fetched once, and the service worker keeps them. After that the
  // record plays with the network off — the piano-audition zones for the
  // theme's own span included, so "hear it on the piano" works on a train.
  let extra = [];
  try {
    if (model.idea && model.idea.on) {
      const t = toNotes(Band.Id.toPhrase(model.idea), themeOpts(model));
      extra = zoneFilesFor(t.notes.map((x) => x.midi));
    }
  } catch (e) {}
  warmCache(extra);
  remember();
}

/* ---------- who a change belongs to ---------- */
// THE COUNTDOWN'S LABEL. An answer given while playing lands bars away (the
// engine walks a runway ahead of the ear), and the page should SAY when —
// which needs a name for what is about to change. The module in view already
// knows: a seat's own answer is that chair, an arranger's answer moves
// everyone, and the ideas module is always about the tune. audio/live.js
// announceChange does the arithmetic; this is only the word.
const seatWord = (who) =>
  who === "engineer" ? "the mix"
  : who === "arranger" ? "the band"
  : "the " + who;
function announce(who, si) {
  announceChange(module_ === "ideas" ? "the tune" : seatWord(who), si);
}

/* ---------- the theme, written down ---------- */
// PLAN Phase 2: a theme RENDERS AS SHEET MUSIC. ui/abc.js compiles the
// phrase the room owns into an ABC string with the kernel's own pitch math,
// and the vendored abcjs (vendor/abcjs/ — MIT, see NOTICE) engraves the SVG.
// THE STAFF FOLLOWS THE THEME, NOT THE ARRANGEMENT (2026-08-21). It used to
// draw only while some section's TAKERS chair carried the tune — so a form
// change (a vamp, an AABA, a blues: no default taker) or a section answered
// "nobody takes it" took the sheet music off the page, and nothing in the
// THEMES area, where the theme is actually edited, could bring it back:
// "keeps disappearing when I change things and never comes back". The law
// now: whenever the record HAS a written theme (m.idea.on — every counted-in
// record does), the staff is on the page; whether anybody plays it is the
// arrangement's business, not the notation's.
let staffLib = null;    // one promise for the vendor chunk — first need only
let staffHost = null;   // the <div> the SVG lives in, KEPT across draws
let staffAbc = "";      // the ABC the CURRENT draw wants engraved
let staffDone = "";     // ...and the ABC actually IN the host's SVG. The old
                        // guard compared against what was last ASKED for, so
                        // an engrave that failed or was skipped (a load
                        // error, a host that missed its window) was never
                        // retried while the music stayed the same; keyed on
                        // what is actually on screen, every draw re-engraves
                        // until the SVG stands

// THE LAZY CHUNK, and why it is a <script> element rather than import():
// the vendor build is a classic UMD whose wrapper hands `this` to the
// factory, and module scope makes `this` undefined — measured in chromium,
// import() of this file parses all 500 KB and then throws "Cannot set
// properties of undefined" before ABCJS exists. A script element runs it as
// the classic script it is: the same URL, one fetch, same-origin and
// service-worker cacheable (audio/offline.js warms it with the record, so a
// warmed record draws its staff with the wire cut), and nothing on the boot
// path — the element is not made until a staff is actually asked for.
function loadStaffLib() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (!staffLib) staffLib = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/abcjs/abcjs-basic-min.js", import.meta.url).href;
    s.async = true;
    s.onload = () => resolve(window.ABCJS);
    s.onerror = () => { staffLib = null; s.remove();
      reject(new Error("abcjs did not arrive")); };
    document.head.append(s);
  });
  return staffLib;
}

// THE STAFF MUST NOT DISAGREE WITH THE SOUND: key, mode and register are
// the same three facts band-kit toGenre hands the kernel (B.KEYS by the
// key answer, dorian/ionian by the minor answer, Id.regOf), and the phrase
// is Id.toPhrase(m.idea) — the theme as the room owns it, before any
// section's chords transpose its bars. One table, read by the ABC compiler
// AND the piano audition, so the two can never disagree either.
const themeOpts = (m) => ({
  key: Band.B.KEYS[m.song.key] || 0,
  mode: m.song.minor ? MODES.dorian : MODES.ionian,
  reg: Band.Id.regOf(m.idea),
  bpm: m.song.bpm,
});

function themeStaff(m) {
  // NOTHING RENDERS WHEN THERE IS NO WRITTEN THEME — and the kept host is
  // dropped with it, so a theme that comes back is engraved fresh, never
  // shown stale. (A record that has been counted in always has one; this
  // guard is the empty room and a recalled pre-theme session.)
  if (!(m.idea && m.idea.on)) {
    staffHost = null; staffAbc = ""; staffDone = "";
    if (auditioning()) stopAudition();
    return null;
  }
  const abc = toABC(Band.Id.toPhrase(m.idea), themeOpts(m));
  // a plain bordered box with the theme's name — the name the RECORD gives
  // it (themeName: a hook when the singer carries it, a riff when the
  // guitar does), the same word the outline's node is titled by
  const fig = el("figure", "dstaff");
  fig.append(el("figcaption", null, Band.themeName(m)));
  if (!staffHost) { staffHost = el("div", "dstaffsvg"); staffDone = ""; }
  fig.append(staffHost);           // the same node every draw: no async flash
  staffAbc = abc;
  // engrave whenever what is ON SCREEN is not this draw's music — a changed
  // theme re-engraves, and so does a host whose last engrave failed, was
  // skipped, or lost its SVG: an error retries on the very next draw
  if (abc !== staffDone || !staffHost.querySelector("svg")) {
    const host = staffHost;
    loadStaffLib().then((A) => {
      // a draw may have moved on while the chunk was on the wire — engrave
      // only what is still current, where it still stands
      if (!A || host !== staffHost || abc !== staffAbc || !host.isConnected) return;
      try {
        A.renderAbc(host, abc, { responsive: "resize" });
        staffDone = host.querySelector("svg") ? abc : "";
      } catch (e) { staffDone = ""; }
    }).catch(() => { staffDone = ""; });  // a failed load retries next draw
  }
  // HEAR IT ON THE PIANO — the theme alone, on the GM grand, through
  // audition.js's own little context: the click is the gesture, the band
  // engine is never touched, and if the band is playing the piano simply
  // plays over it (somebody at the piano in the same room). The button says
  // its own state in a word, like the transport.
  const hear = el("button", "dhear", auditioning() ? "stop" : "hear it on the piano");
  hear.type = "button";
  hear.dataset.k = "hear";
  hear.addEventListener("click", () => {
    if (auditioning()) stopAudition();
    else {
      const t = toNotes(Band.Id.toPhrase(model.idea), themeOpts(model));
      playAudition({ notes: t.notes, bpm: model.song.bpm }, () => {
        const b = document.querySelector(".dhear");
        if (b) b.textContent = "hear it on the piano";
      });
    }
    const b = document.querySelector(".dhear");
    if (b) b.textContent = auditioning() ? "stop" : "hear it on the piano";
  });
  fig.append(hear);
  return fig;
}

/* ---------- draw ---------- */
// ONE PAGE, NO MODES (PLAN.md Phase 1). Three areas stand on the page at
// once, top to bottom — THEMES (the tune the record keeps), SONG (the
// structure, as plain boxes), THE BAND (the chairs) — with a plain rule
// between each. What survives of the old module rail is the one law this
// page always had: only ONE question is on the floor at a time (the gates
// count every `.dopt` on the page, and two open questions would answer each
// other). `module_` now only names WHOSE question that is; each area's
// heading is the button that brings its questions to the floor.
let module_ = "song";

// the heading-word of an area, as a button: tap "themes"/"song"/"band" and
// that area's next question comes to the floor
function modButton(word, key) {
  const b = el("button", "dmod" + (module_ === key ? " on" : ""), word);
  b.type = "button";
  b.dataset.k = "mod|" + key;
  b.addEventListener("click", () => {
    module_ = key; section = null; asking = null; draw(); });
  return b;
}

// A REAL CHOICE WIDGET. An option is a <label class="dopt"> over a hidden
// <input> — the label keeps the class, the exact word (the input contributes
// no text, so a gate's textContent match still holds and label.click() still
// activates it), and the .on paint; the input carries the checked state a
// screen reader can hear. `kind` is "radio" for a one-of-N question,
// "checkbox" for a set of independent toggles ("which notes are accented?"
// can have several on at once, and two checked radios in one group is a
// state HTML refuses to hold).
function optWidget(word, cls, { kind, name, on, dead, key, take }) {
  const lab = el("label", cls);
  const r = el("input");
  r.type = kind; r.name = name; r.checked = !!on;
  r.dataset.k = key;
  if (dead) { r.disabled = true; lab.disabled = true; }  // the gates read .disabled off the .dopt
  r.addEventListener("click", take);
  lab.append(r, document.createTextNode(word));
  return lab;
}

// FOCUS OUTLIVES THE REBUILD. draw() replaces #dwrap wholesale, which used
// to drop keyboard focus to <body> on every answer. Every control carries a
// stable data-k; before the rebuild we note where focus was, after it we put
// it back — on the NEW question's first option when the question on the
// floor changed (answering advances you, and re-tabbing from the top every
// answer is no instrument), else on the re-rendered twin of what was
// focused. Only when focus was IN the pane: a .click() from a gate (or a
// fresh boot) never had it there, so neither moves focus at all.
let floorQ = null;                 // the question on the floor, as the areas render it
let lastQ = null;                  // ...and the previous draw's, to see it advance

function draw() {
  const box = $("dwrap");
  const wasIn = box.contains(document.activeElement);
  const wasKey = (wasIn && document.activeElement.dataset.k) || null;
  floorQ = null;
  render(box);
  if (wasIn) {
    const first = floorQ && floorQ !== lastQ && box.querySelector(".dask .dopt input");
    const same = !first && wasKey &&
      box.querySelector('[data-k="' + CSS.escape(wasKey) + '"]');
    if (first) first.focus(); else if (same) same.focus();
  }
  lastQ = floorQ;
}

function render(box) {
  box.textContent = "";
  // TAP AWAY FROM ANYTHING. Nothing here has to be dismissed: tapping the
  // floor closes whatever is open (a section being arranged, a fact being
  // changed), and tapping another thing just opens that one instead.
  box.onclick = (e) => {
    if (e.target !== box) return;
    if (asking == null && section == null) return;
    asking = null; section = null; draw();
  };

  // BEFORE THE COUNT-IN there is nothing to arrange: one sentence and one
  // word. The three areas appear when the band exists.
  if (!model.on) {
    const start = el("section", "dstart");
    start.append(el("p", "dprose",
      "A band: an arranger, a drummer, a bass player, keys, a guitar, a " +
      "voice and an engineer. Count it in and answer what it asks."));
    const c = el("button", "dchip dbig", "count it in");
    c.type = "button";
    c.dataset.k = "start";
    c.addEventListener("click", () => {
      model = { ...model, on: true };
      ledger.push("a band, waiting to be told what the tune is");
      push(true); draw(); });
    start.append(c);
    box.append(start);
    return;
  }

  // ---- THEMES ---- (the ideas module by its right name — PLAN Phase 2
  // renames the organ; the page starts saying the word now)
  const sThemes = el("section", "dsect");
  { const h = el("h2"); h.append(modButton("themes", "ideas")); sThemes.append(h); }
  // NO PROSE (2026-08-21). Two paragraphs used to explain what a theme is
  // and how to add one — "don't sneak in explanations". The outline IS the
  // explanation: the staff, the theme's own named node, and its questions.
  // The theme itself, written down: the staff stands whenever the record
  // has the tune, and follows every edit — a lifted note, a new key —
  // because draw() recompiles the ABC each pass and re-engraves on change
  const staff = themeStaff(model);
  if (staff) sThemes.append(staff);
  if (module_ === "ideas" && section == null) chairArea(sThemes, "arranger", true);
  box.append(sThemes, el("hr"));

  // ---- SONG ---- the record's structure AS AN OUTLINE (2026-08-21): the
  // sections were the page's one remaining bunched row of boxes; they are
  // nodes of a .dtree now, like everything else — each section a row (its
  // label the role and the bars, the same .dsec button the gates click and
  // the playhead lights), the open section's asks nested BENEATH its own
  // node inline, and "add a box" a plain row at the end.
  const sSong = el("section", "dsect");
  { const h = el("h2"); h.append(modButton("song", "song")); sSong.append(h); }
  const song = toSong(model, MODES);
  const tree = el("ul", "dtree dsong");
  cells = [];
  song.forEach((s2, i) => {
    cells[i] = [[]];
    const li = el("li");
    const b = el("button", "dsec" + (section === i ? " open" : ""));
    b.type = "button";
    b.dataset.k = "sec|" + i;
    b.title = "what is everyone doing here?";
    // the box's name has a SEAM in it for a screen reader ("head, 4 bars",
    // not "head4 bars"), and the hint the title used to hoard is words in
    // the name too — .dvh is text AT and a long-press can reach, invisible
    b.append(el("b", null, s2.role), el("span", "dvh", ", "),
             el("i", null, s2.bars + " bars"));
    const per = s2.per || {};
    const diff = [per.drums && Band.SECDRUMS[per.drums] && Band.SECDRUMS[per.drums].w,
                  per.bass && Band.SECBASS[per.bass] && Band.SECBASS[per.bass].w]
                 .filter(Boolean);
    if (diff.length) b.append(el("span", "dvh", ", "), el("i", "ddiff", diff.join(", ")));
    b.append(el("span", "dvh", " — what is everyone doing here?"));
    b.addEventListener("click", () => {
      module_ = "song";
      section = section === i ? null : i; asking = null; draw(); });
    cells[i][0].push(b);
    li.append(b);
    // the open section's whole conversation, nested under its own node —
    // the same in-place mechanism the chairs use
    if (section === i) sectionArea(li);
    tree.append(li);
  });
  // A BOX IS A SECTION OF THE SONG, and today every box comes from the FORM
  // — there is no per-box append in the model yet, so "add a box" honestly
  // opens the question that decides how many boxes the record has and what
  // each one is. A plain row at the end of the outline.
  { const li = el("li");
    const add = el("button", "dadd", "add a box");
    add.type = "button";
    add.dataset.k = "addbox";
    add.title = "boxes come from the form — open that question";
    add.addEventListener("click", () => {
      module_ = "song"; section = null; asking = "form"; draw(); });
    li.append(add);
    tree.append(li); }
  sSong.append(tree);
  if (section == null && module_ === "song") chairArea(sSong, "arranger", false);
  box.append(sSong, el("hr"));

  // ---- THE BAND ---- the members, each a plain block that says how much
  // it still has to decide. Tap one and its questions take the floor.
  const sBand = el("section", "dsect");
  { const h = el("h2");
    // the visible heading reads "the band"; the button inside it is the
    // word the gates (and a finger) press — but its accessible NAME is the
    // heading's whole phrase: "band" alone is not a thing on this page
    const mb = modButton("band", "band");
    mb.setAttribute("aria-label", "the band");
    h.append(document.createTextNode("the "), mb);
    sBand.append(h); }
  // THE CHAIRS AS AN OUTLINE (2026-08-21). The six seats were a bunched row
  // of blocks with the open seat's sheet rendered somewhere below them all;
  // now the band is one .dtree — each chair a top-level node whose label is
  // the same .dseat button it always was, and the seat you are in expands:
  // its whole gig sheet (instruments and all) nests BENEATH its own chair
  // node, the same outline idiom as everywhere else on the page.
  const seats = el("ul", "dtree dband");
  for (const s2 of SEATS.filter((x) => x !== "arranger")) {
    // HOW MANY, NOT WHETHER. This said "1 question" for every chair that
    // had any question left at all — a chair with nine things still to
    // decide and a chair with one looked identical, which is exactly the
    // thing a session needs to tell you.
    const left = Band.pending(model, s2);
    const b = el("button", "dseat" + (seat === s2 ? " on" : "") + (left ? " asking" : ""));
    b.type = "button";
    b.dataset.k = "seat|" + s2;
    // the count stays the LAST thing in the label (a gate reads the
    // trailing digits); when nothing is left it is a word, not a checkmark
    b.append(el("b", null, s2), document.createTextNode(" — "),
             el("i", null, left ? "questions left: " + left : "all set"));
    b.addEventListener("click", () => {
      seat = s2; module_ = "band"; section = null; asking = null; draw(); });
    const li = el("li", "dchair");
    li.append(b);
    // only the seat you are in carries its sheet — the one-question law is
    // untouched, and the other chairs stay one line each
    if (module_ === "band" && section == null && seat === s2)
      chairArea(li, s2, false);
    seats.append(li);
  }
  sBand.append(seats);
  box.append(sBand);
}

// A SECTION IS OPEN: everything on the floor is about this section. Each
// player's canned parts, then their OWN words — "swap hands", "ride it",
// "walk it" — then the two things a band says that neither player owns
// alone ("give it a lift", "follow the kick").
function sectionArea(parent) {
  const secs = toSong(model, MODES);
  const here = secs[section];
  floorQ = "sec|" + section;
  // THE SECTION'S OWN OUTLINE. A section is arranged as one conversation —
  // every question stays on the floor at once here, exactly as the gates
  // read it — but the same tree law shapes the page: a player's own words
  // ("at the kit", "the bass player") are only there because that player's
  // row is, so they NEST under it and the outline says whose words they are.
  const WORDSOF = { dwords: "drums", kwords: "keys", gwords: "guitar",
                    bwords: "bass", vwords: "voice" };
  const tree = el("ul", "dtree dsectree");
  const liOf = new Map();
  for (const a2 of sectionAsks(model, section)) {
    // a question and its answers are ONE form group — fieldset binds the
    // options to the legend, which stays the .dq the gates read
    const ask2 = el("fieldset", "dask");
    ask2.append(el("legend", "dq", "in the " + (here ? here.role : "section") +
                   ", " + a2.who + "…"));
    const row2 = el("div", "dopts" + (a2.opts.length > 8 ? " dmany" : ""));
    for (const o of a2.opts) {
      row2.append(optWidget(o.w, "dopt" + (o.answered ? " on" : ""), {
        kind: "radio", name: "sq-" + section + "-" + a2.id, on: o.answered,
        key: "opt|sec" + section + "|" + a2.id + "|" + o.key,
        take: () => {
          model = setSection(model, section, a2.id, o.key);
          push(false);
          // scoped to THIS section: the change can only be heard when the
          // section next comes round, and the countdown says so — the label
          // stays the unique key; who/role are the words the phrasing uses
          announceChange(a2.who + " in the " + (here ? here.role : "section"), section,
                         { who: a2.who, role: here ? here.role : "section" });
          draw();
        } }));
    }
    ask2.append(row2);
    const li = el("li");
    li.append(ask2);
    liOf.set(a2.id, li);
    // the words-question rides under the player it belongs to; a pruned
    // player (nothing to ask) leaves its words at the top level rather
    // than dropping them
    const pLi = WORDSOF[a2.id] && liOf.get(WORDSOF[a2.id]);
    if (pLi) {
      let cu = pLi.lastElementChild && pLi.lastElementChild.tagName === "UL"
        ? pLi.lastElementChild : null;
      if (!cu) { cu = el("ul"); pLi.append(cu); }
      cu.append(li);
    } else tree.append(li);
  }
  parent.append(tree);
}

/* ---------- THE COUNT ROW ------------------------------------------------
   "on the e of the one" sixteen times over is a word-pile; a bar is a 4×4
   GRID — columns one two three four, rows the beat / e / and / a — and the
   sentence stays the contract: every cell's tapped word is stepWord's own,
   byte for byte, so nothing a gate (or a ledger) ever read has moved. The
   MARK row above the grid chooses what a tap puts at that place (a note, an
   octave, an accent, a slide…) — everything past the note greys until a
   note exists there, which is the kit's own when-guard made visible. */
const stepWord = Band.B.stepWord;            // one table, every chair counts alike
// a CELL of the count grid — a pitched chair's hit:/note: places, the
// drummer's lane-scoped step:<lane>:<i> — as opposed to the named-shape
// words (shape:<lane>:…) that stay chips under it
const isCellId = (id) => /^(note|hit):\d+$/.test(id) || /^step:[^:]+:\d+$/.test(id);
const barMarks = new Map();                  // who -> which mark is in hand
// which kits have marks beyond the note itself; a pitched chair's bar is
// single-mark (a chord / a strum / sing) and gets the grid alone
const marksOf = (who) =>
  who === "bass" ? Band.B.BARMARKS
  : who === "arranger" ? Band.Id.BARMARKS
  // the drummer's marks are the KIT itself: pick the drum, then say where it
  // goes — the same lane-pinning the drums page does, drawn as the mark row
  : who === "drums" ? Band.D.LANES.map((l) => ({
      lane: l, w: { m: "mid tom", l: "floor tom" }[l] || Band.D.LANEOF(l),
      id: (i) => "step:" + l + ":" + i }))
  : [{ w: null, id: (i) => "hit:" + i }];
// the groups the marks absorb: their words survive as cells under a mark,
// never as a subject question of their own
const MERGED = new Set(["octaves in the bar", "accents in the bar",
                        "notes in the bar", "slides in the bar",
                        "higher", "lower"]);
// the labeled rows, in the order a musician lists them — kit first, then
// the machine panel, then the keys families
const ROWORDER = ["the kick:", "the snare:", "the hats:", "the toms:",
                  "the accents:", "the one:", "calls:",
                  "the filter:", "the squelch:", "the envelope:",
                  "how it closes:", "the wave:",
                  "pianos:", "organs:", "pads & strings:", "synths:", "voices:"];

/* ---------- THE LABEL COLUMN ---------------------------------------------
   The outline's label is a WORD a musician would say, never an id: `atk` is
   "how it comes in", `keysfx` is "the keys", `knob:maxHold` is "how long
   notes hold". ONE table, word per question id — a seat-qualified key wins
   where two chairs share an id (the bass's `reg` is "how low", the theme's
   is "where it sits") — and anything unnamed falls back to its id with the
   prefixes stripped, so a colon-id can never reach the sheet. The
   section-role calls (chg:/len:) are labeled with the ROLE THE RECORD
   SHOWS: band-kit CHGROLE folds build→verse and drop→chorus, and a sheet
   saying "the verse changes" over a record whose boxes read
   build/drop/break would name a role no box on screen has. */
const QLABEL = {
  chords: "the chords",
  "knob:scale": "the scale", "knob:diatonic": "following the chords",
  "knob:stress": "leaning on the beat", "knob:kitProb": "how many hats land",
  "knob:fill": "what fills are made of",
  "knob:phrase": "how the line breathes", "knob:maxHold": "how long notes hold",
  "knob:orn": "the decoration",
  instr: "the instrument", reg: "the register", cut: "how bright",
  atk: "how it comes in", rel: "how it lets go", col: "the colour",
  sit: "against the drums",
  verb: "the reverb", keysfx: "the keys", gtrfx: "the guitar",
  voxfx: "the voice", bassfx: "the bass", bassmix: "where the bass sits",
  "bass:reg": "how low",
  "arranger:len": "how long", "arranger:cell": "the rhythm of it",
  "arranger:contour": "the shape", "arranger:land": "where it lands",
  "arranger:reg": "where it sits",
};
// the role a canonical section-role SHOWS on this record's boxes: the role
// itself when a box carries it, else the first box whose changes it takes
const roleShown = (r) => {
  const secs = (Band.FORMS[model.song.form || "vamp"] || {}).secs || [];
  if (secs.includes(r)) return r;
  // several boxes can take one role's changes (a twelve-inch's intro, build
  // and break all take the verse's) — the OWNER a band would name is the one
  // that is not a way in or a way out
  const cands = secs.filter((s2) => (Band.CHGROLE[s2] || s2) === r);
  return cands.find((s2) => s2 !== "intro" && s2 !== "outro") || cands[0] || r;
};
const qLabel = (who, id0) => {
  const id = id0.replace(/^idea:/, "");
  if (id.startsWith("chg:")) {
    const r = id.slice(4), s2 = roleShown(r);
    return "the " + s2 + (s2 === r ? "" : "\u2019s") + " changes";
  }
  if (id.startsWith("len:")) return "how long the " + roleShown(id.slice(4)) + " runs";
  return QLABEL[who + ":" + id] || QLABEL[id] ||
    id.replace(/^(knob|grp):/, "").replace(/:/g, " ");
};

/* ---------- THE OUTLINE --------------------------------------------------
   PLAN Phase 2: the answered facts used to render as one flat bunch of
   lozenges, which hid the one thing the vocabulary actually has — STRUCTURE.
   These tables say where every question of a seat LIVES in that structure:
   a heading bundles the questions that decide one thing (the record, the
   tune, the time, the form), and an UNDER edge nests a question below the
   answer it exists because of — the chorus's changes exist because the form
   has a chorus, the 303 panel exists because the bass is a synth, a pitched
   chair's bar exists because its job is rhythmic. The dependency edges are
   the vocabulary's own (question-trees walks the same ones); the tables
   only make them visible. A question neither table names still shows, in a
   trailing headless branch — the outline may not swallow a question. */
const OUTLINE = {
  arranger: [
    ["the record", ["when", "where", "venue", "genre"]],
    ["the tune", ["key", "mode", "chords", "knob:scale", "knob:diatonic"]],
    ["the time", ["tempo", "feel", "space"]],
    ["the form", ["form", "arc", "chg:*", "len:*", "end"]],
  ],
  drums: [
    ["the record's kit", ["groove", "the machine"]],
    ["the job", ["job"]],
    ["the time-keeping", ["time", "backbeat"]],
    ["the feel", ["loud", "loose", "knob:stress", "knob:kitProb"]],
    ["the fills", ["fills", "knob:fill", "the fills"]],
    ["at the kit", ["at the kit", "the kit", "take away", "the bar"]],
  ],
  bass: [
    ["the line", ["job", "the figure", "what notes it plays", "the bar"]],
    ["the instrument", ["instr", "what you are playing", "at the machine"]],
    ["the hands", ["sit", "notes", "reg"]],
  ],
  keys: [
    ["the instrument", ["instr"]],
    ["the job", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "atk", "rel", "col", "knob:phrase", "knob:maxHold"]],
  ],
  guitar: [
    ["the instrument", ["instr"]],
    ["the job", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "rel", "knob:orn"]],
  ],
  voice: [
    ["the voice", ["instr"]],
    ["the part", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "atk"]],
  ],
  engineer: [
    // the drums block stays four questions (the gate taps its words); the
    // five channel questions read as one TABLE because the rows align —
    // channel down the label column, treatment beside it
    ["the drums", ["room", "kick", "snare", "hats"]],
    ["the space", ["verb", "delay"]],
    ["the glue", ["squeeze", "tape"]],
    ["the channels", ["keysfx", "gtrfx", "voxfx", "bassfx", "bassmix"]],
  ],
};
// the nesting edges, per seat: pattern -> the pattern of the row it sits
// under. Only real dependencies are drawn — a nest that is merely thematic
// would lie about the graph.
const UNDER = {
  arranger: { "chg:*": "form", "len:*": "form" },
  // ...named in both its costumes: the interview's row before it is
  // answered, the tray's subject ("what you are playing") after
  bass: { "at the machine": ["instr", "what you are playing"] },
  keys: { "the bar": "job" },
  guitar: { "the bar": "job" },
  voice: { "the bar": "job" },
  // the theme: the note-by-note bar exists over the rhythm you chose, and
  // "answer itself" only exists once the tune is longer than a bar
  ideas: { "the bar": "cell", "the answer": "len" },
};
// a pattern names a question by id or by its label (a tray subject's label
// IS its group name); a trailing * is a prefix — the per-role calls the
// form unlocks are chg:verse, chg:chorus…
const outMatch = (p, d) => (p.endsWith("*") ? d.id.startsWith(p.slice(0, -1))
  : d.id === p || d.label === p);

// ONE SURFACE, THREE KINDS OF QUESTION, AND NO MENU. The seat you are in
// is asked its own questions in order; an answered one lands on the GIG
// SHEET and stays tappable, so changing your mind is tapping what you
// said. Rendered into whichever area owns the floor right now.
function chairArea(parent, who, ideasOnly) {
  // this seat's questions: the interview, then one per subject of whatever
  // words the player still has
  const groups = new Map();
  const byId = new Map();                    // the whole vocabulary, for the grid
  // THE DRUMMER'S BAR IS LANE-SCOPED (drums-kit stepsFor lives outside V),
  // so the laneless catalog never carries it. Fetch the pinned lane's own
  // vocabulary — the drum the mark row has in hand — through drums-kit's
  // catalog, exactly as the drums page drives the laneful bar: the count
  // grid, the step ids and say()/says() are all the kit's own.
  const laneNow = who === "drums"
    ? marksOf(who)[Math.min(barMarks.get(who) || 0, Band.D.LANES.length - 1)].lane
    : null;
  const cat = laneNow
    ? [...catalog(model, who), ...Band.D.catalog(model.drums, laneNow)]
    : catalog(model, who);
  for (const i of cat) {
    byId.set(i.id, i);
    if (i.group === "start") continue;
    if (MERGED.has(i.group)) continue;       // absorbed into the bar's marks
    // the arranger's tray IS the theme's vocabulary (catalog(m,"arranger")
    // returns the ideas words and nothing else), so in the SONG area those
    // subjects would be the themes questions asked a second time in a
    // second place — the outline made that duplication visible, and the
    // fix is the COVERS law's own: one home per question. They render in
    // the themes area, where the idea interview covers and dedupes them.
    if (who === "arranger" && !ideasOnly) continue;
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const RANK = { "at the kit": 0, "the line": 0, "the kit": 3,
                 "what you are playing": 3, "take away": 4,
                 "how you play them": 4, "the fills": 5, "the register": 5,
                 "the machine": 6, "the feel": 7 };
  const rank = (g) => (RANK[g] != null ? RANK[g] : g.startsWith("grooves") ? 2 : 10);
  // NOT TWICE. The interview asks "how low?" and the tray carried "down an
  // octave"/"up an octave" as a subject of its own — the same question in
  // two costumes ("you ask twice about octaves"). Any word a decision
  // already offers is not offered again as a subject, and a subject with
  // nothing else in it stops being asked.
  // ...and where the same question is asked in DIFFERENT words, say which:
  // "how low?" and a subject called "the register" are one decision, and
  // word-matching cannot see that ("you ask twice about octaves").
  // ...and the ideas module asks the same five things in its interview and
  // in its tray, so the sheet carried every one of them twice ("the rhythm
  // of it" beside "idea:cell"). Same law, one more table.
  const COVERS = { "the register": ["reg", "idea:reg"], "the feel": ["sit"],
                   "the tempo": ["tempo"], "how you play them": ["notes"],
                   "the line": ["job"], "what you are playing": ["instr"],
                   "the rhythm of it": ["idea:cell"], "the shape": ["idea:contour"],
                   "where it lands": ["idea:land"], "how long": ["idea:len"] };
  // ...and a subject the ARRANGER owns is not a subject a player has. The
  // interview already drops those questions (TAKEN); the tray was still
  // handing the bassist "faster"/"slower" and the drummer the feel.
  const NOTYOURS = { drums: ["the tempo", "the feel"],
                     bass: ["the tempo", "the feel", "the key", "the changes"] };
  const asks0 = Band.asked(model, who)
    .filter((d) => (ideasOnly ? d.id.startsWith("idea:") : !d.id.startsWith("idea:")));
  const asked = new Set(asks0
    .flatMap(d => d.opts.map(o => o.w)));
  const asks = [
    // a fact says what it is, not what its id is: the ideas module prefixes
    // its questions so they can live in the arranger's chair, and nobody
    // needs to read "idea:len" on a gig sheet
    ...asks0.map(d => ({ id: d.id, ask: d.ask, label: qLabel(who, d.id),
      answered: d.answered, opts: d.opts.map(o => ({ w: o.w, row: o.row, on: o.answered,
        istrue: o.active, take: () => { model = answer(model, who, d.id, o.w); } })) })),
    ...[...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([g, list]) => ({
      id: "grp:" + g, ask: GROUPQ[g] || g, label: g,
      // the bar draws as the count grid; its cells live outside `opts` so a
      // word that needs a note first can GREY instead of vanishing
      bar: g === "the bar" && list.some(i => isCellId(i.id) && (i.changes || i.active)),
      answered: (list.find(i => i.active) || {}).words?.[0] || said.get("grp:" + g) || null,
      // A QUESTION NEVER OPENS WITH NOTHING YOU CAN TAP. Half the bass's
      // subjects are about a note that has to exist first — an octave on a
      // step with no note is not a word, it is a blank — so a word that
      // cannot be said and is not already true is not shown, and a subject
      // with nothing left in it is not asked ("when the octave setting first
      // shows up I can't select anything").
      opts: list.filter(i => (i.changes || i.active) && !asked.has(i.words[0]) &&
                             !(g === "the bar" && isCellId(i.id)))
        .map(i => ({ w: i.words[0], row: i.row,
        on: i.active || said.get("grp:" + g) === i.words[0],
        dead: false,
        take: () => {
          const line = says(model, who, i.id);
          const before = model;
          model = say(model, who, i.id);
          if (model !== before) ledger.push(line);
          said.set("grp:" + g, i.words[0]);
        } })) })),
  ].filter(d => (d.opts.length || d.bar) &&
    // COVERS/NOTYOURS are laws about tray SUBJECTS (a group whose question
    // an interview row already asks). An interview row wears a word of its
    // own for a label now, and must not be eaten for matching one.
    !(d.id.startsWith("grp:") &&
      ((COVERS[d.label] || []).some(id => asks0.some(x => x.id === id)) ||
       (NOTYOURS[who] || []).includes(d.label))));

  // NOTHING LEFT TO ASK IS NOTHING TO SAY. There is no line telling you to
  // tap something: everything on this page is already tappable, and a
  // sentence explaining that is the sentence a good surface does not need.
  // (A stale `asking` — "add a box" before the form is reachable — falls
  // back to the next unanswered question rather than an empty floor.)
  // Found FIRST so the outline can mark which of its rows holds the floor.
  // A RE-ASK WITH NOTHING TO CHANGE TO IS NOT A QUESTION: the pruner can
  // leave an answered interview fact exactly one option — its own answer —
  // and a button that opens a one-radio fieldset is a dead end in a
  // control's clothes. Such a fact renders as plain text and never takes
  // the floor.
  const flatFact = (d) => d.answered && !d.bar && !d.id.startsWith("grp:") &&
    d.opts.length < 2;
  const q = (asking && asks.find(d => d.id === asking && !flatFact(d))) ||
    asks.find(d => !d.answered);

  // THE GIG SHEET AS AN OUTLINE. Every question of this seat is a row —
  // an answered one says its word, an open one says its ask in italics —
  // grouped and nested by the OUTLINE/UNDER tables above, expanded, always.
  // A row is the same tappable .dfact it always was (the gates find facts
  // by the <b> label and the data-k, and both stay put); the one-question
  // law holds: tapping a row brings its question to the floor, and the
  // floor is IN PLACE now — the fieldset opens directly under that row's
  // own <li> (see the end of this function), never at a fixed slot below
  // the sheet, so at most one set of options exists at any time.
  const spec = ideasOnly
    // the theme's node is titled by what the record DOES with the tune —
    // Band.themeName derives hook/riff/figure/chant, nobody is asked
    ? [[Band.themeName(model), ["len", "cell", "the bar", "contour", "land", "reg", "the answer"]]]
    : OUTLINE[who] || [];
  const under = (ideasOnly ? UNDER.ideas : UNDER[who]) || {};
  const rowLi = new Map();                     // ask id -> its <li>, for the edges
  const rowOf = (d) => {
    const li = el("li");
    if (flatFact(d)) {
      const f2 = el("span", "dfact dflat");
      f2.dataset.k = "fact|" + d.id;
      f2.append(el("b", null, d.label), el("span", "dvh", ", "),
                el("span", "dans", d.answered));
      li.append(f2);
      return li;
    }
    const c = el("button", "dfact" + (asking === d.id ? " open" : "") +
                           (q && q.id === d.id ? " qnow" : ""));
    c.type = "button";
    c.dataset.k = "fact|" + d.id;
    c.title = d.answered ? "change it: " + d.ask : d.ask;
    c.append(el("b", null, d.label), el("span", "dvh", ", "),
             d.answered ? el("span", "dans", d.answered)
                        : el("span", "dhint", d.ask));
    c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
    // THE ROW AND ITS QUESTION ARE ONE BOX (2026-08-21, Paul: "a dotted box
    // shows up with options below… put the options INSIDE"): the row whose
    // question holds the floor is wrapped in a .dqbox — the dashed outline
    // lives on the wrapper now, and the fieldset lands inside it (end of
    // this function), so the label you tapped tops the box and the options
    // sit within the same dashes, never as a sibling below them.
    if (q && q.id === d.id) {
      const w2 = el("div", "dqbox");
      w2.append(c);
      li.append(w2);
    } else li.append(c);
    return li;
  };
  const placed = new Set();
  const branches = [];
  for (const [h, pats] of spec) {
    const list = [];
    for (const p of pats) for (const d of asks) {
      if (placed.has(d.id) || !outMatch(p, d)) continue;
      placed.add(d.id); list.push([p, d]);
    }
    if (list.length) branches.push([h, list]);
  }
  // whatever the tables do not name still shows — the outline may not
  // swallow a question the seat can be asked
  const rest = asks.filter(d => !placed.has(d.id)).map(d => [null, d]);
  if (rest.length) branches.push([null, rest]);
  const tree = el("ul", "dtree");
  for (const [h, list] of branches) {
    const li = el("li", "dbranch");
    if (h) li.append(el("span", "dthead", h));
    const ul = el("ul");
    for (const [p, d] of list) {
      const row = rowOf(d);
      rowLi.set(d.id, row);
      // the dependency edge: this row nests under the row it exists
      // because of (the parent renders first — the tables order it so)
      const pk = p && under[p];
      const pks = !pk ? [] : Array.isArray(pk) ? pk : [pk];
      const pAsk = pks.length && asks.find(a => pks.some((x) => outMatch(x, a)));
      const pLi = pAsk && rowLi.get(pAsk.id);
      if (pLi) {
        let cu = pLi.lastElementChild && pLi.lastElementChild.tagName === "UL"
          ? pLi.lastElementChild : null;
        if (!cu) { cu = el("ul"); pLi.append(cu); }
        cu.append(row);
      } else ul.append(row);
    }
    li.append(ul);
    tree.append(li);
  }
  if (branches.length) parent.append(tree);
  if (asks.some(d => d.answered)) {
    // ...and one way back. A chair you cannot clear is a chair you stop
    // trying things in.
    const again = el("button", "dfact dagain", "start over");
    again.type = "button";
    again.dataset.k = "again|" + who;
    again.title = "clear this chair and ask again";
    again.addEventListener("click", () => {
      model = Band.resetSeat(model, who);
      said.clear(); asking = null; push(false); announce(who, null); draw();
    });
    parent.append(again);
  }
  if (!q) return;
  floorQ = who + "|" + q.id + (ideasOnly ? "|ideas" : "");
  // a question and its answers are ONE form group — fieldset binds the
  // options to the legend, which stays the .dq the gates read. An interview
  // decision is one-of-N (radios); a grp: subject is a set of independent
  // toggles (checkboxes) — several of its words can be true at once
  const ask = el("fieldset", "dask");
  ask.append(el("legend", "dq", q.ask));
  // THE COUNT GRID. The bar renders as cells — columns one..four, rows the
  // beat/e/and/a — with the MARK row above it choosing what a tap puts
  // there. A cell's word is stepWord's own sentence, byte for byte.
  if (q.bar) {
    const marks = marksOf(who);
    const mi = Math.min(barMarks.get(who) || 0, marks.length - 1);
    if (marks.length > 1) {
      const mrow = el("div", "dmarks");
      mrow.append(el("span", "dmarklab", "put"));
      marks.forEach((mk, ix) => {
        const b = el("button", "dmark" + (ix === mi ? " on" : ""), mk.w);
        b.type = "button";
        b.dataset.k = "mark|" + who + "|" + mk.w;
        b.addEventListener("click", () => { barMarks.set(who, ix); draw(); });
        mrow.append(b);
      });
      ask.append(mrow);
    }
    const grid = el("div", "dgrid");
    grid.append(el("span", "dghead dgcorner", ""));
    for (const c of ["one", "two", "three", "four"]) grid.append(el("span", "dghead", c));
    const SUBS = ["\u00b7", "e", "and", "a"];
    for (let sub = 0; sub < 4; sub++) {
      grid.append(el("span", "dglead", SUBS[sub]));
      for (let beat = 0; beat < 4; beat++) {
        const i = beat * 4 + sub;
        const entry = byId.get(marks[mi].id(i));
        const on = !!(entry && entry.active);
        // everything past the note greys until a note exists at that place —
        // the kit's own when-guard made visible, never a vanished word
        const dead = !entry || (!entry.changes && !entry.active);
        grid.append(optWidget(stepWord(i), "dopt dcell" + (on ? " on" : ""), {
          kind: "checkbox", name: "bar-" + who, on, dead,
          key: "opt|" + who + "|grp:the bar|" + (entry ? entry.id : i),
          take: () => {
            if (!entry) return;
            const line = says(model, who, entry.id);
            const before = model;
            model = say(model, who, entry.id);
            if (model !== before) { ledger.push(line); push(false); announce(who, null); }
            said.set("grp:the bar", stepWord(i));
            draw();
          } }));
      }
    }
    ask.append(grid);
  }
  // a big bundle of options scans as aligned columns, not a ragged wrap
  // (PLAN: "the bundle of options is hard to scan") — same words, same
  // widgets, only the layout
  const row = el("div", "dopts" + (q.opts.length > 8 ? " dmany" : ""));
  const kind = q.id.startsWith("grp:") ? "checkbox" : "radio";
  // LABELED ROWS, NOT WORD-PILES: when every option names its row (the
  // kick:, the filter:, pianos:…), the options group under those labels in
  // the order a musician lists them
  let opts2 = q.opts;
  const rowed = opts2.length > 0 && opts2.every(o => o.row);
  if (rowed) {
    const at = (r) => { const ix = ROWORDER.indexOf(r); return ix < 0 ? ROWORDER.length : ix; };
    opts2 = [...opts2].sort((a, b) => at(a.row) - at(b.row));
  }
  let lastRow = null;
  for (const o of opts2) {
    if (rowed && o.row !== lastRow) { row.append(el("span", "drowlab", o.row)); lastRow = o.row; }
    row.append(optWidget(o.w, "dopt" + (o.on ? " on" : "") +
                               (!o.on && o.istrue ? " istrue" : ""), {
      kind, name: "q-" + who + "-" + q.id, on: o.on, dead: o.dead,
      key: "opt|" + who + "|" + q.id + "|" + o.w,
      take: () => {
        const before = model;
        o.take();
        if (model !== before) { push(false); announce(who, null); }
        if (asking) asking = null;
        draw();
      } }));
  }
  ask.append(row);
  // THE RECORD'S LENGTH IS A FACT, NOT A QUESTION: the form × the lengths
  // already decide it, so the form node simply says what they add up to
  if (q.id === "form") {
    const song = toSong(model, MODES);
    const bars = song.reduce((n, s2) => n + s2.bars, 0);
    const secs = Math.round(bars * 4 * 60 / (model.song.bpm || 96));
    ask.append(el("p", "dlen", "that\u2019s " + Math.floor(secs / 60) + ":" +
                               String(secs % 60).padStart(2, "0")));
  }
  // INLINE, IN PLACE (2026-08-21). The question used to land at a fixed
  // slot below the whole sheet; it opens AT ITS ROW now \u2014 the outline
  // expands at that node and the page grows vertically. Every ask has a
  // row (the trailing headless branch catches whatever the tables do not
  // name), and the fieldset lands INSIDE the row's own .dqbox \u2014 one
  // dashed box holding label and options both \u2014 so it still sits above
  // any child rows that nest beneath the same node.
  const qLi = rowLi.get(q.id);
  const qBox = qLi && qLi.querySelector(":scope > .dqbox");
  if (qBox) qBox.append(ask);
  else if (qLi && qLi.firstElementChild) qLi.firstElementChild.after(ask);
  else parent.append(ask);
}

const GROUPQ = {
  "at the machine": "what is the machine set to?",
  "what notes it plays": "what notes does the line use?",
  "notes in the bar": "which notes take a different degree?",
  "the figure": "what's the line, exactly?",
  "the bar": "where do the notes go?",
  "octaves in the bar": "which notes jump an octave?",
  "accents in the bar": "which notes are accented?",
  "slides in the bar": "which notes slide into the next?",
  "at the kit": "how are you playing it?",
  "the line": "what is the line doing?",
  "the changes": "what are the changes?",
  "the key": "what key?",
  "the kit": "what’s in the kit?",
  "what you are playing": "what are you playing?",
  "take away": "take something out?",
  "how you play them": "how are you playing them?",
  "the fills": "what about the fills?",
  "the register": "how high?",
  "the machine": "which machine?",
  "the feel": "how does it feel?",
  "the tempo": "how fast?",
};

/* ---------- THE PLAYHEAD -------------------------------------------------
   One rAF loop, and it never redraws: it moves a class along the columns it
   was handed at draw time. The position comes from the engine's own clock
   (audio/live.js getPosition / passAt), so what lights is what you hear. */
let at = -1;
function tick() {
  if (playing && cells.length) {
    let step = -1;
    try {
      const p = getPosition();
      step = p && p.si >= 0 ? p.si : -1;      // which SECTION is sounding
    } catch (e) { step = -1; }
    if (step !== at) {
      if (at >= 0) for (const c of (cells[at] && cells[at][0]) || []) c.classList.remove("now");
      if (step >= 0) for (const c of (cells[step] && cells[step][0]) || []) c.classList.add("now");
      at = step;
    }
  } else if (at >= 0) {
    for (const bar of cells) for (const col of bar) for (const c of col) c.classList.remove("now");
    at = -1;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- the transport ---------- */
// START AGAIN — the whole session, not one chair. Every chair has its own
// `start over` on its own sheet; this is the one that puts the room back to
// empty, so the next record can begin from "when is it?" rather than
// from whatever the last one decided.
$("dreset").addEventListener("click", () => {
  if (playing) { stop(); playWord(); }
  model = { ...Band.blank(), on: true };
  said.clear(); asking = null; section = null; module_ = "song"; seat = "drums";
  ledger.length = 0;
  clearMixOffsets();
  try { localStorage.removeItem(SAVE); } catch (e) {}
  push(true); draw();
});
// THE DICE — a whole record by answering every question at random, which is
// only possible because the graph is complete: every question has at least
// two answers and none of them leads anywhere unplayable. It is the ordinary
// path taken quickly, not a special one.
$("ddice").addEventListener("click", () => {
  model = Band.randomSong();
  said.clear(); asking = null; section = null; module_ = "song";
  ledger.length = 0;
  clearMixOffsets();
  push(true); draw();
  if (!playing) startAt(0);
  playWord(true);
});
$("dplay").addEventListener("click", () => {
  if (playing) { stop(); playWord(); }
  else if (model.on) { startAt(0); playWord(true); }
});
// THE PLAY KEY SAYS ITS OWN STATE IN A WORD — "play" or "stop", never a
// glyph (PLAN Phase 1). `startAt` opens the engine asynchronously, so the
// optimistic `onNow` keeps the word honest at the tap and the
// transport:state echo settles it either way.
function playWord(onNow) {
  const b = $("dplay"), isOn = !!onNow || playing;
  b.textContent = isOn ? "stop" : "play";
  b.classList.toggle("on", isOn);
}
on("transport:state", () => playWord());

/* ---------- the beat counter and the change countdown ---------- */
// PLAN Phase 1a: the transport SAYS where it is (bar.beat) and WHEN a change
// just made will be heard ("the bass — changes in 8 beats… 7…"). Both are
// plain text off the engine's own feeds — audio/live.js emits "pos" once per
// beat and "pending" once per count — so this is rendering, not timekeeping.
const beatEl = $("dbeat"), pendEl = $("dpending"), liveEl = $("dlive");
const pend = new Map();                       // label -> the last "pending" payload
on("pos", (d) => {
  beatEl.textContent = "bar " + (d.bar + 1) + "." + d.beat;
});
// SPEAK LIKE A MUSICIAN, NOT A LOG. "the melody in the drop — changes in 21
// beats; the drums in the drop — changes in 21 beats" was true and unreadable:
// the big number was left to explain, by itself, that the drop is far away.
// So a section-scoped landing SAYS WHY ("the drums change when the drop comes
// round — 21", off the feed's own `round`), an imminent one just counts ("the
// melody changes in 5"), everything landing on the SAME bar is one sentence,
// lines run soonest first, at most two, and the rest is "+ n more waiting".
const pluralish = (w) => { const t = w.split(" ").pop();
  return t.length > 1 && t.slice(-1) === "s" && t !== "bass"; };
function pendPhrase(names, d) {
  const subj = names.length === 1 ? names[0]
    : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  const verb = (names.length > 1 || pluralish(subj)) ? "change" : "changes";
  return d.round && d.role
    ? subj + " " + verb + " when the " + d.role + " comes round — " + d.beatsLeft
    : subj + " " + verb + " in " + d.beatsLeft;
}
function drawPending() {
  const at = new Map();                       // landsSerial -> one line's facts
  for (const p of pend.values()) {
    const g = at.get(p.landsSerial) ||
      { s: p.landsSerial, names: [], beatsLeft: p.beatsLeft, round: false, role: null };
    if (g.names.indexOf(p.who || p.label) < 0) g.names.push(p.who || p.label);
    g.beatsLeft = Math.min(g.beatsLeft, p.beatsLeft);
    if (p.round && !g.round) { g.round = true; g.role = p.role; }
    at.set(p.landsSerial, g);
  }
  const lines = [...at.values()].sort((a, b) => a.s - b.s);
  pendEl.textContent = "";
  for (const g of lines.slice(0, 2))
    pendEl.append(el("div", "dpline", pendPhrase(g.names, g)));
  if (lines.length > 2)
    pendEl.append(el("div", "dpmore", "+ " + (lines.length - 2) + " more waiting"));
}
on("pending", (d) => {
  // beatsLeft 0 is the landing: the change is in the air, so the line goes
  if (d.beatsLeft === 0) pend.delete(d.label);
  else {
    // ...and a screen reader hears each promise ONCE, when its label first
    // appears: one polite write per new label, never per beat tick — the
    // ticking stays in #dpending, which is not live on purpose
    if (!pend.has(d.label) && liveEl)
      liveEl.textContent = pendPhrase([d.who || d.label], d);
    pend.set(d.label, d);
  }
  drawPending();
});
on("transport:state", () => {
  if (!playing) { pend.clear(); beatEl.textContent = ""; pendEl.textContent = "";
    if (liveEl) liveEl.textContent = ""; }
});

/* ---------- boot ---------- */
window.__nuTempo = () => model.song.bpm;      // the gate reads tempo as part of the artifact
// THE SESSION SURVIVES A RELOAD, which is what makes the offline cache worth
// having: coming back to a dead network and being handed an empty room is
// the same as not having cached anything. One key, the model as it stands.
const SAVE = "nu.band.session";
function remember() {
  try { localStorage.setItem(SAVE, JSON.stringify(model)); } catch (e) {}
}
function recall() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    const m = JSON.parse(raw);
    if (!m || !m.on || !m.song || !m.drums || !m.bass || !m.keys) return false;
    model = { ...Band.blank(), ...m };
    return true;
  } catch (e) { return false; }
}

registerSW();
warmShell();
window.__bandWarm = () => warmed();               // the gate asks what is cached
window.__bandDraw = () => draw();                  // the gate times a redraw
window.__bandModel = () => JSON.stringify(model);   // ...and the model, so a
// word that is lost can be located: did the MODEL move, or only the plan?
// ...and the session you left, if there is one. A cached record you cannot
// come back to is a cached record nobody hears twice.
recall();
push(true);
warmup();
draw();
// the first word arms the machine and starts it — nobody taps play to hear
// the thing they just made
const armed = () => { if (model.on && !playing && !settling) startAt(0); };
on("box", armed);
