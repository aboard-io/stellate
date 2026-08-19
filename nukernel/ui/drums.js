// nukernel/drums/main.js — THE DRUM MACHINE YOU TALK TO. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const { blank, catalog, say, says, toGenre, LANEOF, LANES,
        decisions, nextAsk, answer } = window.NuDrums;
import { GENRES, NuSong } from "./deps.js";
import { adoptSong, SONG, on, commit, setBpm, setSwing } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GK = "lab.drums";            // the session genre this machine writes
let cells = [];                    // the pattern's cells, for the playhead
let asking = null;                 // a decision being revisited, if any
let model = blank();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes
let lane = null;                   // the pinned lane, or null
let ledger = [];                   // what has been said, in order
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
const loopBars = () => (lane ? 1 : 4);
function push(first) {
  // THE VERSION IS THE POINT: this genre is rewritten in place on every
  // word, and ui/derive.js's per-box render cache reads `__v` to know that
  // (without it the sound never changed — the cache kept serving the first
  // kit it ever saw)
  GENRES[GK] = { ...toGenre(model), __v: ++ver };
  setBpm(model.bpm);
  // the swing is the SONG's, and derive.js turns the word into the number
  // the kernel wants (the genre must never carry the word itself)
  setSwing(model.swing || null);
  if (first) {
    // the loader's own shapes, or the box is refused for a field nobody here
    // has an opinion about (song[0].nudge, the first time this was tried)
    const box = { ...NuSong.emptyBox(), stack: [{ g: GK, slots: [0] }], len: loopBars() };
    adoptSong({ v: NuSong.VERSION, bpm: model.bpm, genres: {},
                slots: [NuSong.blank()], song: [box] }, "drums");
  } else {
    const box = SONG[0];
    if (box && box.len !== loopBars()) box.len = loopBars();
    commit("box"); commit("swing");
  }
  commit("transport");
  // (NO JUMP HERE. Sending the walk back to the top of the loop on every
  // word was a latency hack and it cost more than it bought: the record
  // RESTARTED at bar one each time you said something, so the four-bar
  // cycle never reached its own fourth measure — "you reset after the first
  // measure instead of still looping". The loop keeps running; the edit
  // lands on the next bar the engine asks for, which is measurably ONE bar
  // ahead of the ear.)
}

/* ---------- draw ---------- */
function draw() {
  const box = $("dwrap");
  box.textContent = "";

  // THE PATTERN ITSELF, above the transcript: four bars, the lanes that are
  // playing, one cell per sixteenth. It is a PICTURE, not an editor — you
  // still change it by saying things — but a drum machine you cannot see is
  // a drum machine you have to hold in your head.
  if (model.on) {
    const g = toGenre(model);
    const rows = LANES.filter(l => g.kits.some(b => (b[l] || []).some(Boolean)));
    const grid = el("div", "dgrid");
    cells = [];                      // [bar][step] -> the elements in that column
    for (let b = 0; b < 4; b++) { cells[b] = []; for (let i = 0; i < 16; i++) cells[b][i] = []; }
    for (const l of rows) {
      const row = el("div", "drow");
      row.append(el("i", "dlane", LANEOF(l)));
      g.kits.forEach((bar, bi) => {
        const b = el("div", "dbar" + (model.fills[bi + 1] ? " fill" : "")
          + (bi >= loopBars() ? " out" : ""));
        for (let i = 0; i < 16; i++) {
          // the step's LEVEL is its velocity (a ghost is a 2, an accent a 9),
          // so the picture shows how hard as well as whether
          const v = (bar[l] || [])[i] || 0;
          const cell = el("i", "dcell" + (v ? " hit" : "")
            + (v > 1 && v <= 4 ? " ghost" : "") + (v >= 9 ? " accent" : "")
            + (i % 4 === 0 ? " beat" : "") + (l === lane ? " lit" : ""));
          cells[bi][i].push(cell);
          b.append(cell);
        }
        row.append(b);
      });
      grid.append(row);
    }
    box.append(grid);
  }

  // THE GIG SHEET — what this drummer has decided, and the one thing they
  // have not decided yet. A drummer sitting down does not reach for a step
  // grid; they want to know how fast, whether it swings, what kind of record
  // this is and what their job in it is. So the questions come first, in the
  // order a drummer answers them, and everything else is what you say after
  // you have sat down.
  let q = null;
  if (model.on) {
    const ds = decisions(model);
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

    q = asking ? ds.find(d => d.id === asking) : nextAsk(model);
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
          model = answer(model, q.id, o.w);
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

  // NOTHING BELOW THE PATTERN BUT QUESTIONS. The transcript and the wall of
  // chips are gone: what you are looking at is the pattern, and what you are
  // being asked is one question. Every word the machine knows is still
  // reachable — the groups it used to print as headings are now the options
  // of the last question ("anything else?"), so a word is two taps instead of
  // a scroll past ninety dim buttons.
  const words = lane ? [...catalog(model, lane), ...catalog(model, null)]
                     : catalog(model, null);
  const groups = new Map();
  for (const i of words) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const RANK = { "the bar": 0, "at the kit": 1, "the kit": 3, "take away": 4,
                 "the fills": 5, "the machine": 6, "the feel": 7, "the tempo": 8,
                 "start": 9 };
  const rank = (g) => (RANK[g] != null ? RANK[g] : g.startsWith("grooves") ? 2 : 10);
  const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
                    .filter(([g]) => g !== "start");

  // BEFORE THE MACHINE IS ON there is exactly one thing to say.
  if (!model.on) {
    const start = el("div", "dstart");
    start.append(el("p", "dwhat", "a drummer, sitting down. tap once and it starts asking."));
    for (const i of words) {
      if (!i.changes) continue;
      const c = el("button", "dchip dbig", i.words[0]);
      c.type = "button";
      c.addEventListener("click", () => {
        ledger.push(says(model, i.id)); model = say(model, i.id); push(false); draw(); });
      start.append(c);
    }
    box.append(start);
    return;
  }

  // a group of words, asked. Saying one keeps you in the group — you are
  // placing hits or trying kits, and one tap per visit was the old wall's
  // other problem.
  const askGroup = (g, list, close) => {
    const ask = el("div", "dask");
    ask.append(el("h2", "dq", GROUPQ[g] || g));
    const row = el("div", "dopts");
    for (const i of list) {
      if (!i.changes && !i.active) continue;
      const c = el("button", "dopt" + (i.active ? " on" : ""), i.words[0]);
      c.type = "button";
      if (!i.changes) c.disabled = true;
      c.addEventListener("click", () => {
        const laneId = i.id.startsWith("lane:") ? LANEWORDLANE(i.id) : null;
        const before = model;
        const line = says(model, i.id);
        model = say(model, i.id);
        if (model !== before) ledger.push(line);
        const wasLane = lane;
        if (laneId) { lane = laneId; topic = "the bar"; }
        if (model !== before || lane !== wasLane) push(false);
        draw();
      });
      row.append(c);
    }
    ask.append(row);
    const back = el("button", "dpinkey", close);
    back.type = "button";
    back.addEventListener("click", () => {
      if (lane) { lane = null; push(false); }
      topic = null; draw();
    });
    ask.append(back);
    box.append(ask);
  };

  // a pinned lane IS a question — the bar's own counting, looping one bar
  if (lane) {
    askGroup("the bar", groups.get("the bar") || [],
             "done with the " + LANEOF(lane) + " ✕");
    return;
  }
  if (q) return;                       // one question at a time
  if (topic && groups.has(topic)) { askGroup(topic, groups.get(topic), "back ✕"); return; }

  // ...and when the interview is over, the LAST question is which of the
  // machine's own subjects you want to talk about.
  const ask = el("div", "dask");
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

// what each group of words is ASKING. A heading is a label; a question is an
// invitation, and this page is a drummer talking.
const GROUPQ = {
  "the bar": "where does it go in the bar?",
  "at the kit": "how are you playing it?",
  "the kit": "what kit is this?",
  "take away": "take something out?",
  "the fills": "what about the fills?",
  "the machine": "which machine?",
  "the feel": "how does it feel?",
  "the tempo": "how fast?",
};
const LANEWORDLANE = (id) => {
  const key = id.slice(5);
  const L = { hats: "h", openhats: "o", claps: "c", perc: "p", toms: "t",
              kick: "k", snare: "s" };
  return L[key] || null;
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
      const f = p ? passAt(p.now).f : 0;            // 0..1 across whatever loops
      const n = loopBars() * 16;
      step = Math.max(0, Math.min(n - 1, Math.floor(f * n)));
    } catch (e) { step = -1; }
    if (step !== at) {
      const off = (n) => { const b = (n / 16) | 0, i = n % 16;
        for (const c of (cells[b] && cells[b][i]) || []) c.classList.remove("now"); };
      if (at >= 0) off(at);
      if (step >= 0) { const b = (step / 16) | 0, i = step % 16;
        for (const c of (cells[b] && cells[b][i]) || []) c.classList.add("now"); }
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
GENRES[GK] = toGenre(model);
window.__nuTempo = () => model.bpm;      // the gate reads tempo as part of the artifact
window.__drumModel = () => JSON.stringify(model);   // ...and the model, so a
// word that is lost can be located: did the MODEL move, or only the plan?
push(true);
warmup();
draw();
// the first word arms the machine and starts it — nobody taps play to hear
// the thing they just made
const armed = () => { if (model.on && !playing) startAt(0); };
on("box", armed);
