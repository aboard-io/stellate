// nukernel/ui/bass.js — THE BASS PLAYER YOU TALK TO. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const { blank, catalog, say, says, toGenre, decisions, nextAsk, answer } = window.NuBass;
import { GENRES, NuSong, MODES } from "./deps.js";
import { adoptSong, SONG, on, commit, setBpm, setSwing, setPoolChair } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GK = "lab.bass";             // the session genre this player writes
let cells = [];                    // the pattern's cells, for the playhead
let asking = null;                 // a decision being revisited, if any
let model = blank();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes

let ledger = [];                   // what has been said, in order

/* ---------- the model reaches the engine ---------- */
// the kit becomes a GENRE (kit.js toGenre) installed in the live table, and
// the song is four bars of it — which is every mechanism the engine already
// has for drums and no new one.
let ver = 0;
// the loop is the CHANGES: a twelve-bar blues loops twelve, a vamp four
const loopBars = () => { try { return toGenre(model, MODES).bars || 4; } catch (e) { return 4; } };
function push(first) {
  // THE VERSION IS THE POINT: this genre is rewritten in place on every
  // word, and ui/derive.js's per-box render cache reads `__v` to know that
  // (without it the sound never changed — the cache kept serving the first
  // kit it ever saw)
  GENRES[GK] = { ...toGenre(model, MODES), __v: ++ver };
  setBpm(model.bpm);
  // the swing is the SONG's, and derive.js turns the word into the number
  // the kernel wants (the genre must never carry the word itself)
  setSwing(model.swing || null);
  // the bass chair plays what the player picked up
  setPoolChair("bass", model.instr);
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

  // THE LINE ITSELF, above the transcript: the changes as bars, and where
  // the notes fall in each. A bassist reads the CHANGES first, so the bar
  // shows its root, and the notes under it are the line through it.
  if (model.on) {
    const g = toGenre(model, MODES);
    const K = window.NuKernel;
    const empty16 = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
      vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
      gate: new Array(16).fill(0), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
    let ev = [];
    try { ev = K.bass(empty16, g, g.bars); } catch (e) { ev = []; }
    const lo = ev.length ? Math.min(...ev.map(e => e.n)) : 0;
    const hi = ev.length ? Math.max(...ev.map(e => e.n)) : 1;
    const grid = el("div", "dgrid");
    cells = [];
    for (let b = 0; b < g.bars; b++) { cells[b] = []; for (let i = 0; i < 16; i++) cells[b][i] = []; }
    const row = el("div", "drow bassrow");
    for (let b = 0; b < g.bars; b++) {
      const bar = el("div", "dbar");
      for (let i = 0; i < 16; i++) {
        const at = ev.filter(e => Math.floor(e.t / 16) === b && Math.round(e.t % 16) === i);
        const cell = el("i", "dcell" + (at.length ? " hit" : "") + (i % 4 === 0 ? " beat" : ""));
        if (at.length) {
          // the note's HEIGHT in the bass's own range, so the line has shape
          const f = hi > lo ? (at[0].n - lo) / (hi - lo) : 0.5;
          cell.style.setProperty("--h", (18 + f * 60).toFixed(0) + "%");
        }
        cells[b][i].push(cell);
        bar.append(cell);
      }
      row.append(bar);
    }
    grid.append(row);
    box.append(grid);
  }

  // THE GIG SHEET — what this drummer has decided, and the one thing they
  // have not decided yet. A drummer sitting down does not reach for a step
  // grid; they want to know how fast, whether it swings, what kind of record
  // this is and what their job in it is. So the questions come first, in the
  // order a drummer answers them, and everything else is what you say after
  // you have sat down.
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

    const q = asking ? ds.find(d => d.id === asking) : nextAsk(model);
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

  // WHAT IT IS DOING, in words — the transcript
  const said = el("div", "dsaid");
  if (!ledger.length) said.append(el("p", "dhint", "tap a word"));
  for (const line of ledger.slice(-3)) said.append(el("p", "dline", line));
  box.append(said);


  // THE WORDS — ALL of them, grouped, with whatever is already true LIT.
  // A word that would change nothing is still shown (it is the readout: the
  // machine's state IS which words are lit); a pinned lane ADDS the bar's
  // own counting rather than replacing the machine's words, so naming a
  // hi-hat never strands you inside the hats.
  const words = catalog(model);
  const groups = new Map();
  for (const i of words) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  // THE DRUMMER'S WORDS COME FIRST. They describe PLAYING rather than
  // choosing, so they are what you reach for once a groove is down — and the
  // bar you have open beats even those.
  const RANK = { "the line": 0, "the changes": 1, "the key": 2,
                 "what you are playing": 3, "how you play them": 4,
                 "the register": 5, "the feel": 6, "the tempo": 7, "start": 8 };
  const rank = (g) => (RANK[g] != null ? RANK[g] : 9);
  // BEFORE THE MACHINE IS ON there is exactly one thing to say, and burying
  // it under a hundred dim words was the difference between "a new thing"
  // and "the same wall as yesterday". A word that would change nothing is
  // shown ONLY once the machine is playing — that is when a dim word is a
  // readout rather than noise.
  const scroll = el("div", "dscroll");
  if (!model.on) {
    const start = el("div", "dstart");
    start.append(el("p", "dwhat", "a bass player, sitting down. tap once and it starts asking."));
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
  scroll.append(el("i", "dg dgtop", "or say something specific"));
  for (const [g, list] of [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))) {
    const wrap = el("div", "dgroup");
    wrap.append(el("i", "dg", g));
    for (const i of list) {
      const c = el("button", "dchip" + (i.active ? " on" : "") +
                             (!i.changes && !i.active ? " dim" : ""), i.words[0]);
      c.type = "button";
      if (!i.changes) c.disabled = true;
      c.addEventListener("click", () => {
        if (model !== before) push(false);
        draw();
      });
      wrap.append(c);
    }
    scroll.append(wrap);
  }
  box.append(scroll);
}

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
GENRES[GK] = toGenre(model, MODES);
window.__nuTempo = () => model.bpm;      // the gate reads tempo as part of the artifact
window.__bassModel = () => JSON.stringify(model);   // ...and the model, so a
// word that is lost can be located: did the MODEL move, or only the plan?
push(true);
warmup();
draw();
// the first word arms the machine and starts it — nobody taps play to hear
// the thing they just made
const armed = () => { if (model.on && !playing) startAt(0); };
on("box", armed);
