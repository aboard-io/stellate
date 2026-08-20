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
import { adoptSong, SONG, on, commit, setBpm, setSwing, setPoolChair,
         setMixOffset, clearMixOffsets } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GKP = "lab.band.";           // one session genre per section of the form
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
// LIVE WHILE EDITING. With a lane pinned you are placing hits one at a time,
// and waiting out a four-bar form to hear each one is the difference between
// an instrument and a form. So the loop SHORTENS to one bar while a lane is
// open — the same engine, the same kit, the bar you are working on coming
// round every couple of seconds — and the whole four-bar form (with its
// fills) comes back the moment you close the lane.
function push(first) {
  const song = toSong(model, MODES);
  song.forEach((s2, i) => { GENRES[GKP + i] = { ...s2.genre, __v: ++ver }; });
  // any genre from a longer previous form must stop being referenced
  for (let i = song.length; i < 24; i++) delete GENRES[GKP + i];
  setBpm(model.song.bpm);
  setSwing(model.song.swing || null);
  setPoolChair("bass", model.bass.instr);
  // THE ENGINEER'S HAND ON THE DESK. Everything the fourth chair decides is
  // a mix OFFSET (ui/state.js MIXER, applied in audio/desk.js over the
  // composed mix), so the engineer needs no audio path of its own — it is
  // the same board the mixer page writes. Cleared and rewritten whole on
  // every push: what the engineer said IS the board on this page.
  clearMixOffsets();
  for (const [chan, vals] of Object.entries(Band.mixOf(model)))
    for (const [k, v] of Object.entries(vals)) setMixOffset(chan, k, v);
  const boxes = song.map((s2, i) => ({ ...NuSong.emptyBox(),
    stack: [{ g: GKP + i, slots: [0] }], len: s2.bars, role: s2.role, cue: s2.role,
    // ...and the engineer's hand on THIS section: the box's own strip
    ...(s2.box || {}) }));
  if (first) adoptSong({ v: NuSong.VERSION, bpm: model.song.bpm, genres: {},
                         slots: [NuSong.blank()], song: boxes }, "band");
  else {
    // the form can change length, so the box list is replaced in place
    SONG.length = 0; for (const b of boxes) SONG.push(b);
    commit("box"); commit("swing");
  }
  commit("transport");
}

/* ---------- draw ---------- */
function draw() {
  const box = $("dwrap");
  box.textContent = "";

  // THE TAKE, section by section: what the arranger called, with the one
  // that is sounding lit. A band's picture is its FORM.
  if (model.on) {
    const song = toSong(model, MODES);
    const form = el("div", "dgrid");
    const row = el("div", "drow");
    cells = [];
    song.forEach((s2, i) => {
      cells[i] = [[]];
      const b = el("button", "dsec" + (section === i ? " open" : ""));
      b.type = "button";
      b.title = "what is everyone doing here?";
      b.append(el("b", null, s2.role), el("i", null, s2.bars + " bars"));
      const per = s2.per || {};
      const diff = [per.drums && Band.SECDRUMS[per.drums] && Band.SECDRUMS[per.drums].w,
                    per.bass && Band.SECBASS[per.bass] && Band.SECBASS[per.bass].w]
                   .filter(Boolean);
      if (diff.length) b.append(el("i", "ddiff", diff.join(" · ")));
      b.addEventListener("click", () => {
        section = section === i ? null : i; asking = null; draw(); });
      cells[i][0].push(b);
      row.append(b);
    });
    form.append(row);
    box.append(form);
  }

  // WHO YOU ARE TALKING TO. A session is three jobs, and the questions you
  // are asked depend on whose chair you are in.
  if (model.on) {
    const bar = el("div", "dseats");
    for (const s2 of SEATS) {
      // HOW MANY, NOT WHETHER. This said "1 question" for every chair that
      // had any question left at all — a chair with nine things still to
      // decide and a chair with one looked identical, which is exactly the
      // thing a session needs to tell you.
      const left = seatDecisions(model, s2).filter(d => !d.answered).length;
      const b = el("button", "dseat" + (seat === s2 ? " on" : "") + (left ? " asking" : ""));
      b.type = "button";
      b.append(el("b", null, s2), el("i", null,
        left ? left + (left === 1 ? " question" : " questions") : "ready"));
      b.addEventListener("click", () => { seat = s2; asking = null; draw(); });
      bar.append(b);
    }
    box.append(bar);
  }

  // ONE SURFACE, THREE KINDS OF QUESTION, AND NO MENU. The seat you are in
  // is asked its own questions in order; an answered one lands on the GIG
  // SHEET and stays tappable, so changing your mind is tapping what you
  // said. A section that is open takes the floor entirely — that is where
  // the band arranges, in the players' own words.
  if (!model.on) {
    const start = el("div", "dstart");
    start.append(el("p", "dwhat", "an arranger and two players. tap once and the session starts."));
    const c = el("button", "dchip dbig", "count it in");
    c.type = "button";
    c.addEventListener("click", () => {
      model = { ...model, on: true };
      ledger.push("a band, waiting to be told what the tune is");
      push(true); draw(); });
    start.append(c);
    box.append(start);
    return;
  }

  // A SECTION IS OPEN: everything on the floor is about this section. Each
  // player's canned parts, then their OWN words — "swap hands", "ride it",
  // "walk it" — then the two things a band says that neither player owns
  // alone ("give it a lift", "follow the kick").
  if (section != null) {
    const secs = toSong(model, MODES);
    const here = secs[section];
    for (const a2 of sectionAsks(model, section)) {
      const ask2 = el("div", "dask");
      ask2.append(el("h2", "dq", "in the " + (here ? here.role : "section") +
                     ", " + a2.who + "…"));
      const row2 = el("div", "dopts");
      for (const o of a2.opts) {
        const b2 = el("button", "dopt" + (o.answered ? " on" : ""), o.w);
        b2.type = "button";
        b2.addEventListener("click", () => {
          model = setSection(model, section, a2.id, o.key);
          push(false); draw();
        });
        row2.append(b2);
      }
      ask2.append(row2);
      box.append(ask2);
    }
    const done = el("button", "dpinkey", "done with this section ✕");
    done.type = "button";
    done.addEventListener("click", () => { section = null; draw(); });
    box.append(done);
    return;
  }

  // this seat's questions: the interview, then one per subject of whatever
  // words the player still has (the arranger has none — their vocabulary is
  // the questions above and the sections below)
  const groups = new Map();
  for (const i of catalog(model, seat)) {
    if (i.group === "start") continue;
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const RANK = { "at the kit": 0, "the line": 0, "the kit": 3,
                 "what you are playing": 3, "take away": 4,
                 "how you play them": 4, "the fills": 5, "the register": 5,
                 "the machine": 6, "the feel": 7 };
  const rank = (g) => (RANK[g] != null ? RANK[g] : g.startsWith("grooves") ? 2 : 10);
  const asks = [
    ...seatDecisions(model, seat).map(d => ({ id: d.id, ask: d.ask, label: d.id,
      answered: d.answered, opts: d.opts.map(o => ({ w: o.w, on: o.answered,
        istrue: o.active, take: () => { model = answer(model, seat, d.id, o.w); } })) })),
    ...[...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([g, list]) => ({
      id: "grp:" + g, ask: GROUPQ[g] || g, label: g,
      answered: (list.find(i => i.active) || {}).words?.[0] || said.get("grp:" + g) || null,
      opts: list.map(i => ({ w: i.words[0],
        on: i.active || said.get("grp:" + g) === i.words[0],
        dead: !i.changes && !i.active,
        take: () => {
          const line = says(model, seat, i.id);
          const before = model;
          model = say(model, seat, i.id);
          if (model !== before) ledger.push(line);
          said.set("grp:" + g, i.words[0]);
        } })) })),
  ];

  // THE GIG SHEET — every fact of it tappable
  const sheet = el("div", "dsheet");
  for (const d of asks) {
    if (!d.answered) continue;
    const c = el("button", "dfact" + (asking === d.id ? " open" : ""));
    c.type = "button";
    c.title = "change it: " + d.ask;
    c.append(el("b", null, d.label), document.createTextNode(" " + d.answered));
    c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
    sheet.append(c);
  }
  if (sheet.childNodes.length) box.append(sheet);

  const q = asking ? asks.find(d => d.id === asking) : asks.find(d => !d.answered);
  if (!q) {
    const ask = el("div", "dask");
    ask.append(el("h2", "dq", seat === "arranger"
      ? "tap a section to say what happens in it"
      : "tap anything above to change it"));
    box.append(ask);
    return;
  }
  const ask = el("div", "dask");
  ask.append(el("h2", "dq", q.ask));
  const row = el("div", "dopts");
  for (const o of q.opts) {
    const b = el("button", "dopt" + (o.on ? " on" : "") +
                           (!o.on && o.istrue ? " istrue" : ""), o.w);
    b.type = "button";
    if (o.dead) b.disabled = true;
    b.addEventListener("click", () => {
      const before = model;
      o.take();
      if (model !== before) push(false);
      if (asking) asking = null;
      draw();
    });
    row.append(b);
  }
  ask.append(row);
  if (asking) {
    const done = el("button", "dpinkey", "done ✕");
    done.type = "button";
    done.addEventListener("click", () => { asking = null; draw(); });
    ask.append(done);
  }
  box.append(ask);
}

const GROUPQ = {
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
$("dplay").addEventListener("click", () => {
  if (playing) { stop(); $("dplay").classList.remove("on"); }
  else if (model.on) { startAt(0); $("dplay").classList.add("on"); }
});
on("transport:state", () => $("dplay").classList.toggle("on", playing));

/* ---------- boot ---------- */
window.__nuTempo = () => model.song.bpm;      // the gate reads tempo as part of the artifact
window.__bandModel = () => JSON.stringify(model);   // ...and the model, so a
// word that is lost can be located: did the MODEL move, or only the plan?
push(true);
warmup();
draw();
// the first word arms the machine and starts it — nobody taps play to hear
// the thing they just made
const armed = () => { if (model.on && !playing) startAt(0); };
on("box", armed);
