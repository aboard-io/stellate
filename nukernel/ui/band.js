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
import { adoptSong, SONG, on, commit, setBpm, setSwing, setPoolChair } from "./state.js";
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
let topic = null;                  // a group of words being asked about

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
  const boxes = song.map((s2, i) => ({ ...NuSong.emptyBox(),
    stack: [{ g: GKP + i, slots: [0] }], len: s2.bars, role: s2.role, cue: s2.role }));
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
        section = section === i ? null : i; asking = null; topic = null; draw(); });
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
      const q = nextAsk(model, s2);
      const b = el("button", "dseat" + (seat === s2 ? " on" : "") + (q ? " asking" : ""));
      b.type = "button";
      b.append(el("b", null, s2), el("i", null, q ? "1 question" : "ready"));
      b.addEventListener("click", () => { seat = s2; asking = null; draw(); });
      bar.append(b);
    }
    box.append(bar);
  }

  // THE GIG SHEET — what this drummer has decided, and the one thing they
  // have not decided yet. A drummer sitting down does not reach for a step
  // grid; they want to know how fast, whether it swings, what kind of record
  // this is and what their job in it is. So the questions come first, in the
  // order a drummer answers them, and everything else is what you say after
  // you have sat down.
  let q = null;
  if (model.on) {
    const ds = seatDecisions(model, seat);
    const sheet = el("div", "dsheet");
    for (const d of ds) {
      if (!d.answered) continue;
      const c = el("button", "dfact");
      c.type = "button";
      c.title = "change it: " + d.ask;
      c.append(el("b", null, d.id), document.createTextNode(" " + d.answered));
      c.addEventListener("click", () => { asking = d.id; draw(); });
      sheet.append(c);
    }
    if (sheet.childNodes.length) box.append(sheet);

    // THE SEAT YOU ARE IN IS THE SEAT THAT IS ASKED. `nextAsk` defaults to
    // the model's own seat, which is not the chair the page is showing, so
    // sitting down at the drums used to hand you the arranger's next
    // question with the drummer's name over it.
    q = section != null ? null
      : (asking ? ds.find(d => d.id === asking) : nextAsk(model, seat));
    if (q) {
      const ask = el("div", "dask");
      ask.append(el("h2", "dq", q.ask));
      const row = el("div", "dopts");
      for (const o of q.opts) {
        const b = el("button", "dopt" + (o.answered ? " on" : "") +
                              (!o.answered && o.active ? " istrue" : ""), o.w);
        b.type = "button";
        b.addEventListener("click", () => {
          const before = model;
          model = answer(model, seat, q.id, o.w);
          if (model !== before) { ledger.push(q.ask + " " + o.w); push(false); }
          asking = null;
          draw();
        });
        row.append(b);
      }
      ask.append(row);
      box.append(ask);
    }
  }

  // NOTHING BELOW THE PICTURE BUT QUESTIONS. No transcript, no wall of
  // chips: the form is what you look at, and one question is what you answer.
  // Every word each seat knows is still reachable — the groups the wall used
  // to print as headings are the options of the last question.
  const words = catalog(model, seat);
  const groups = new Map();
  for (const i of words) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const RANK = { "at the kit": 0, "the line": 0, "the changes": 1, "the key": 1,
                 "the kit": 3, "what you are playing": 3, "take away": 4,
                 "how you play them": 4, "the fills": 5, "the register": 5,
                 "the machine": 6, "the feel": 7, "the tempo": 8, "start": 9 };
  const rank = (g) => (RANK[g] != null ? RANK[g] : g.startsWith("grooves") ? 2 : 10);
  const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
                    .filter(([g]) => g !== "start");

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

  // A SECTION IS OPEN: the questions become what each player does HERE. The
  // gig sheet set the tune up; this is the part where a band decides the
  // chorus is different from the verse.
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

  if (q) return;                       // one question at a time

  const askGroup = (g, list) => {
    const ask2 = el("div", "dask");
    ask2.append(el("h2", "dq", GROUPQ[g] || g));
    const row2 = el("div", "dopts");
    for (const i of list) {
      if (!i.changes && !i.active) continue;
      const c = el("button", "dopt" + (i.active ? " on" : ""), i.words[0]);
      c.type = "button";
      if (!i.changes) c.disabled = true;
      c.addEventListener("click", () => {
        const before = model;
        const line = says(model, seat, i.id);
        model = say(model, seat, i.id);
        if (model !== before) { ledger.push(line); push(false); }
        draw();
      });
      row2.append(c);
    }
    ask2.append(row2);
    const back = el("button", "dpinkey", "back ✕");
    back.type = "button";
    back.addEventListener("click", () => { topic = null; draw(); });
    ask2.append(back);
    box.append(ask2);
  };
  if (topic && groups.has(topic)) { askGroup(topic, groups.get(topic)); return; }

  const ask = el("div", "dask");
  // THE ARRANGER HAS NO WORDS OF THEIR OWN — an arranger's whole vocabulary
  // is the questions above and the sections below, so saying "anything
  // else?" over an empty row is a dead end. They get pointed at the form.
  if (!ordered.length) {
    ask.append(el("h2", "dq", "tap a section to say what happens in it"));
    box.append(ask);
    return;
  }
  ask.append(el("h2", "dq", "anything else?"));
  const row = el("div", "dopts");
  for (const [g] of ordered) {
    const c = el("button", "dopt", GROUPQ[g] || g);
    c.type = "button";
    c.addEventListener("click", () => { topic = g; draw(); });
    row.append(c);
  }
  ask.append(row);
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
