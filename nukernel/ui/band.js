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
  // record plays with the network off.
  warmCache();
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
  // the one visible sentence that answers "how do I add a theme"
  sThemes.append(el("p", "dprose",
    "A theme is a tune the record keeps coming back to — a hook, a riff, a " +
    "chant. To add one, tap “themes” above and answer what it " +
    "asks: how long it runs, how it moves, where it lands."));
  if (module_ === "ideas" && section == null) chairArea(sThemes, "arranger", true);
  box.append(sThemes, el("hr"));

  // ---- SONG ---- the record's structure as a set of plain boxes, the
  // sounding one lit by the playhead. A band's picture is its form.
  const sSong = el("section", "dsect");
  { const h = el("h2"); h.append(modButton("song", "song")); sSong.append(h); }
  const song = toSong(model, MODES);
  const row = el("div", "drow");
  cells = [];
  song.forEach((s2, i) => {
    cells[i] = [[]];
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
    row.append(b);
  });
  sSong.append(row);
  // A BOX IS A SECTION OF THE SONG, and today every box comes from the FORM
  // — there is no per-box append in the model yet (Phase 2's outline is
  // where one would live), so "add a box" honestly opens the question that
  // decides how many boxes the record has and what each one is.
  const add = el("button", "dadd", "add a box");
  add.type = "button";
  add.dataset.k = "addbox";
  add.title = "boxes come from the form — open that question";
  add.addEventListener("click", () => {
    module_ = "song"; section = null; asking = "form"; draw(); });
  sSong.append(add);
  if (section != null) sectionArea(sSong);
  else if (module_ === "song") chairArea(sSong, "arranger", false);
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
  const seats = el("div", "dseats");
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
    seats.append(b);
  }
  sBand.append(seats);
  if (module_ === "band" && section == null) chairArea(sBand, seat, false);
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
  for (const a2 of sectionAsks(model, section)) {
    // a question and its answers are ONE form group — fieldset binds the
    // options to the legend, which stays the .dq the gates read
    const ask2 = el("fieldset", "dask");
    ask2.append(el("legend", "dq", "in the " + (here ? here.role : "section") +
                   ", " + a2.who + "…"));
    const row2 = el("div", "dopts");
    for (const o of a2.opts) {
      row2.append(optWidget(o.w, "dopt" + (o.answered ? " on" : ""), {
        kind: "radio", name: "sq-" + section + "-" + a2.id, on: o.answered,
        key: "opt|sec" + section + "|" + a2.id + "|" + o.key,
        take: () => {
          model = setSection(model, section, a2.id, o.key);
          push(false);
          // scoped to THIS section: the change can only be heard when the
          // section next comes round, and the countdown says so
          announceChange(a2.who + " in the " + (here ? here.role : "section"), section);
          draw();
        } }));
    }
    ask2.append(row2);
    parent.append(ask2);
  }
}

// ONE SURFACE, THREE KINDS OF QUESTION, AND NO MENU. The seat you are in
// is asked its own questions in order; an answered one lands on the GIG
// SHEET and stays tappable, so changing your mind is tapping what you
// said. Rendered into whichever area owns the floor right now.
function chairArea(parent, who, ideasOnly) {
  // this seat's questions: the interview, then one per subject of whatever
  // words the player still has
  const groups = new Map();
  for (const i of catalog(model, who)) {
    if (i.group === "start") continue;
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
                   "where it ends": ["idea:land"], "how long": ["idea:len"] };
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
    ...asks0.map(d => ({ id: d.id, ask: d.ask, label: d.id.replace(/^idea:/, ""),
      answered: d.answered, opts: d.opts.map(o => ({ w: o.w, on: o.answered,
        istrue: o.active, take: () => { model = answer(model, who, d.id, o.w); } })) })),
    ...[...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([g, list]) => ({
      id: "grp:" + g, ask: GROUPQ[g] || g, label: g,
      answered: (list.find(i => i.active) || {}).words?.[0] || said.get("grp:" + g) || null,
      // A QUESTION NEVER OPENS WITH NOTHING YOU CAN TAP. Half the bass's
      // subjects are about a note that has to exist first — an octave on a
      // step with no note is not a word, it is a blank — so a word that
      // cannot be said and is not already true is not shown, and a subject
      // with nothing left in it is not asked ("when the octave setting first
      // shows up I can't select anything").
      opts: list.filter(i => (i.changes || i.active) && !asked.has(i.words[0]))
        .map(i => ({ w: i.words[0],
        on: i.active || said.get("grp:" + g) === i.words[0],
        dead: false,
        take: () => {
          const line = says(model, who, i.id);
          const before = model;
          model = say(model, who, i.id);
          if (model !== before) ledger.push(line);
          said.set("grp:" + g, i.words[0]);
        } })) })),
  ].filter(d => d.opts.length &&
    !((COVERS[d.label] || []).some(id => asks0.some(x => x.id === id))) &&
    !((NOTYOURS[who] || []).includes(d.label)));

  // THE GIG SHEET — every fact of it tappable
  const sheet = el("div", "dsheet");
  for (const d of asks) {
    if (!d.answered) continue;
    const c = el("button", "dfact" + (asking === d.id ? " open" : ""));
    c.type = "button";
    c.dataset.k = "fact|" + d.id;
    c.title = "change it: " + d.ask;
    c.append(el("b", null, d.label), document.createTextNode(" " + d.answered));
    c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
    sheet.append(c);
  }
  if (sheet.childNodes.length) {
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
    sheet.append(again);
    parent.append(sheet);
  }

  // NOTHING LEFT TO ASK IS NOTHING TO SAY. There is no line telling you to
  // tap something: everything on this page is already tappable, and a
  // sentence explaining that is the sentence a good surface does not need.
  // (A stale `asking` — "add a box" before the form is reachable — falls
  // back to the next unanswered question rather than an empty floor.)
  const q = (asking && asks.find(d => d.id === asking)) || asks.find(d => !d.answered);
  if (!q) return;
  floorQ = who + "|" + q.id + (ideasOnly ? "|ideas" : "");
  // a question and its answers are ONE form group — fieldset binds the
  // options to the legend, which stays the .dq the gates read. An interview
  // decision is one-of-N (radios); a grp: subject is a set of independent
  // toggles (checkboxes) — several of its words can be true at once
  const ask = el("fieldset", "dask");
  ask.append(el("legend", "dq", q.ask));
  const row = el("div", "dopts");
  const kind = q.id.startsWith("grp:") ? "checkbox" : "radio";
  for (const o of q.opts) {
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
  parent.append(ask);
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
  "the kit": "what kit is this?",
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
// empty, so the next record can begin from "what decade is it?" rather than
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
const pend = new Map();                       // label -> beats left
on("pos", (d) => {
  beatEl.textContent = "bar " + (d.bar + 1) + "." + d.beat;
});
on("pending", (d) => {
  // beatsLeft 0 is the landing: the change is in the air, so the line goes
  if (d.beatsLeft === 0) pend.delete(d.label);
  else {
    // ...and a screen reader hears the countdown ONCE, when its label first
    // appears: one polite write per new label, never per beat tick — the
    // ticking stays in #dpending, which is not live on purpose
    if (!pend.has(d.label) && liveEl)
      liveEl.textContent = d.label + " — changes in " + d.beatsLeft +
        (d.beatsLeft === 1 ? " beat" : " beats");
    pend.set(d.label, d.beatsLeft);
  }
  pendEl.textContent = [...pend.entries()]
    .map(([l, n]) => l + " — changes in " + n + (n === 1 ? " beat" : " beats"))
    .join("; ");
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
