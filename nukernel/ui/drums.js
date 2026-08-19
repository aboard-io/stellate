// nukernel/drums/main.js — THE DRUM MACHINE YOU TALK TO. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const { blank, offered, say, says, toGenre, LANEOF } = window.NuDrums;
import { GENRES, NuSong } from "./deps.js";
import { adoptSong, on, commit, setBpm } from "./state.js";
import { startAt, stop, playing, warmup } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GK = "lab.drums";            // the session genre this machine writes
let model = blank();
let lane = null;                   // the pinned lane, or null
let ledger = [];                   // what has been said, in order

/* ---------- the model reaches the engine ---------- */
// the kit becomes a GENRE (kit.js toGenre) installed in the live table, and
// the song is four bars of it — which is every mechanism the engine already
// has for drums and no new one.
function push(first) {
  GENRES[GK] = toGenre(model);
  setBpm(model.bpm);
  if (first) {
    // the loader's own shapes, or the box is refused for a field nobody here
    // has an opinion about (song[0].nudge, the first time this was tried)
    const box = { ...NuSong.emptyBox(), stack: [{ g: GK, slots: [0] }], len: 4 };
    adoptSong({ v: NuSong.VERSION, bpm: model.bpm, genres: {},
                slots: [NuSong.blank()], song: [box] }, "drums");
  } else commit("box");
  commit("transport");
}

/* ---------- draw ---------- */
function draw() {
  const box = $("dwrap");
  box.textContent = "";

  // WHAT IT IS DOING, in words — the only readout, because the pattern has
  // no other form here
  const said = el("div", "dsaid");
  if (!ledger.length) said.append(el("p", "dhint", "tap a word"));
  for (const line of ledger.slice(-8)) said.append(el("p", "dline", line));
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

  // THE WORDS. Only what would change something (kit.js `when`), grouped —
  // and a pinned lane ADDS the bar's own counting rather than replacing the
  // machine's words, so naming a hi-hat never strands you inside the hats.
  const words = lane ? [...offered(model, lane), ...offered(model, null)]
                     : offered(model, null);
  const groups = new Map();
  for (const i of words) {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  }
  for (const [g, list] of groups) {
    const wrap = el("div", "dgroup");
    wrap.append(el("i", "dg", g));
    for (const i of list) {
      const lit = i.lane && i.step != null && model.kit[i.lane] && model.kit[i.lane][i.step];
      const c = el("button", "dchip" + (lit ? " on" : ""), i.words[0]);
      c.type = "button";
      c.addEventListener("click", () => {
        // a LANE word pins that lane (and seeds it if it is empty)
        const laneId = i.id.startsWith("lane:") ? LANEWORDLANE(i.id) : null;
        const before = model;
        ledger.push(says(model, i.id));
        model = say(model, i.id);
        if (laneId) lane = laneId;
        if (model !== before || laneId) push(false);
        draw();
      });
      wrap.append(c);
    }
    box.append(wrap);
  }
}
const LANEWORDLANE = (id) => {
  const key = id.slice(5);
  const L = { hats: "h", openhats: "o", claps: "c", perc: "p", toms: "t",
              kick: "k", snare: "s" };
  return L[key] || null;
};

/* ---------- the transport ---------- */
$("dplay").addEventListener("click", () => {
  if (playing) { stop(); $("dplay").classList.remove("on"); }
  else if (model.on) { startAt(0); $("dplay").classList.add("on"); }
});
on("transport:state", () => $("dplay").classList.toggle("on", playing));

/* ---------- boot ---------- */
GENRES[GK] = toGenre(model);
push(true);
warmup();
draw();
// the first word arms the machine and starts it — nobody taps play to hear
// the thing they just made
const armed = () => { if (model.on && !playing) startAt(0); };
on("box", armed);
