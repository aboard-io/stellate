// nukernel/drums/main.js — THE DRUM MACHINE YOU TALK TO. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const { blank, catalog, say, says, toGenre, LANEOF, LANES } = window.NuDrums;
import { GENRES, NuSong } from "./deps.js";
import { adoptSong, on, commit, setBpm, setSwing } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GK = "lab.drums";            // the session genre this machine writes
let cells = [];                    // the pattern's cells, for the playhead
let model = blank();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes
let lane = null;                   // the pinned lane, or null
let ledger = [];                   // what has been said, in order

/* ---------- the model reaches the engine ---------- */
// the kit becomes a GENRE (kit.js toGenre) installed in the live table, and
// the song is four bars of it — which is every mechanism the engine already
// has for drums and no new one.
let ver = 0;
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
    const box = { ...NuSong.emptyBox(), stack: [{ g: GK, slots: [0] }], len: 4 };
    adoptSong({ v: NuSong.VERSION, bpm: model.bpm, genres: {},
                slots: [NuSong.blank()], song: [box] }, "drums");
  } else { commit("box"); commit("swing"); }
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
        const b = el("div", "dbar" + (model.fills[bi + 1] ? " fill" : ""));
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

  // WHAT IT IS DOING, in words — the transcript
  const said = el("div", "dsaid");
  if (!ledger.length) said.append(el("p", "dhint", "tap a word"));
  for (const line of ledger.slice(-3)) said.append(el("p", "dline", line));
  box.append(said);

  // the pinned lane, if one is open
  if (lane) {
    const pin = el("div", "dpin");
    const b = el("button", "dpinkey", LANEOF(lane) + " ✕");
    b.type = "button";
    b.addEventListener("click", () => { lane = null; draw(); });
    pin.append(el("i", "dpl", "talking about the"), b);
    box.append(pin);
  }

  // THE WORDS — ALL of them, grouped, with whatever is already true LIT.
  // A word that would change nothing is still shown (it is the readout: the
  // machine's state IS which words are lit); a pinned lane ADDS the bar's
  // own counting rather than replacing the machine's words, so naming a
  // hi-hat never strands you inside the hats.
  const words = lane ? [...catalog(model, lane), ...catalog(model, null)]
                     : catalog(model, null);
  const groups = new Map();
  for (const i of words) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  const scroll = el("div", "dscroll");
  for (const [g, list] of groups) {
    const wrap = el("div", "dgroup");
    wrap.append(el("i", "dg", g));
    for (const i of list) {
      const c = el("button", "dchip" + (i.active ? " on" : "") +
                             (!i.changes && !i.active ? " dim" : ""), i.words[0]);
      c.type = "button";
      if (!i.changes) c.disabled = true;
      c.addEventListener("click", () => {
        // a LANE word pins that lane (and seeds it if it is empty)
        const laneId = i.id.startsWith("lane:") ? LANEWORDLANE(i.id) : null;
        const before = model;
        const line = says(model, i.id);
        model = say(model, i.id);
        if (model !== before) ledger.push(line);
        if (laneId) lane = laneId;
        if (model !== before || laneId) push(false);
        draw();
      });
      wrap.append(c);
    }
    scroll.append(wrap);
  }
  box.append(scroll);
}
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
      const f = p ? passAt(p.now).f : 0;            // 0..1 across the four bars
      step = Math.max(0, Math.min(63, Math.floor(f * 64)));
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
