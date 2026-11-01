// THE LILGUYS PAGE — the band of four, on the web app's own composer and
// engine. What it keeps from the FM-1 (aboard-io/stellate-lilguys):
//
//   * THE BAND IS FOUR. Drums, bass, the third chair (keys, a guitar, a horn,
//     a pad…) and the lead. A genre's document can seat five or six lines; the
//     page keeps the harmony voice and the tune and lets the rest go, so every
//     sound you hear belongs to someone on the stage.
//   * THE INTERFACE IS THE CHARACTERS. Nothing else is on the page until you
//     click one: then its motifs open in a piano roll.
//   * A CHANGE IS HEARD, not announced. Edits go through the same compile the
//     main page uses (ui/eight.js push) and land on the next bar the engine
//     has not yet rendered.
//
// And one thing the hardware could not do: the PLAY-ALONG STAFF. "I'll play
// this part" mutes the member and scrolls its part — as actually played, after
// the sections have developed the motif — under a fixed playhead.
import { GENRES, MODES, NuDocument, NuDeskDoc, NuPrecompose, NuSong, NuWiki } from "../ui/deps.js";
import { adoptSong, SONG, putPhrase, commit, setBpm, setSwing, setMeter, setGroove,
         setBasis, setMaster, setBuses, setRubato, setLoopOnly, loopOnly, on, bpm } from "../ui/state.js";
import { startAt, stop, playing, warmup, songBeatNow, getPosition } from "../audio/live.js";
import * as plan from "../audio/plan.js";
import { scoreOf } from "../export/score.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";
import { drawSprite, quaver, zee, COL, BG, INK, MID, LOOK, BASS, mix } from "./sprites.js";
import { Roll } from "./roll.js";
import { Staff, keySig } from "./staff.js";

const $ = (id) => document.getElementById(id);
const GK = "lab.lilguys.";
const K = window.NuKernel;
const NAMES = ["DRUMS", "BASS", "KEYS", "LEAD"];

/* ---------- the document, cut to a band of four ---------- */
let DOC = null, GENRE = null, SEED = 1, GENRE_BPM = 120;
let members = [null, null, null, null];   // the doc voice each member is (or null)
const partOf = (v) => (v.cast && v.cast.part) || "line";
const KEYS_ORDER = ["pad", "stab", "riff", "drone", "counter", "line", "lead"];

function leadOf(lines) {                  // export/move.js leadOf: the song's tune
  const sung = lines.findIndex((v) => partOf(v) === "lead" && /vox/.test(v.instrument || ""));
  if (sung >= 0) return sung;
  for (const want of ["lead", "line", "riff", "counter"]) {
    const i = lines.findIndex((v) => partOf(v) === want);
    if (i >= 0) return i;
  }
  return lines.length ? 0 : -1;
}

function trimBand(doc) {
  const lines = doc.voices.filter((v) => v.kind === "line");
  const li = leadOf(lines);
  const lead = li >= 0 ? lines[li] : null;
  // the third chair: whoever plays in the most sections (a voice that is "out"
  // everywhere but one chorus is a guest, not a member), the harmony parts first
  const playsIn = (v) => doc.form.sections.filter((s) => (v.development || {})[s.id] !== "out").length;
  const rest = lines.filter((v) => v !== lead)
    .sort((a, b) => playsIn(b) - playsIn(a) || KEYS_ORDER.indexOf(partOf(a)) - KEYS_ORDER.indexOf(partOf(b)));
  const keys = rest[0] || null;
  const bass = doc.voices.find((v) => v.kind === "bass") || null;
  const drums = doc.voices.find((v) => v.kind === "drums") || null;
  // the harmony voice first: document.js reads the first line for the chords
  doc.voices = [keys, lead, bass, drums].filter(Boolean);
  members = [drums, bass, keys, lead];
}

const NATIVE = SYNTH_NAMES();
const secId = (i) => (DOC.form.sections[i] || {}).id;
const genreFor = (si) => NuDocument.toGenre(DOC, si, GENRES, NATIVE);

/* ---------- the compile: ui/eight.js push(), the band's share of it ---------- */
function push(first) {
  const secs = DOC.form.sections, NS = secs.length;
  secs.forEach((s, i) => { GENRES[GK + i] = genreFor(i); });
  for (let i = NS; i < 64; i++) delete GENRES[GK + i];
  setBasis(DOC.basis || null);
  const lines = DOC.voices.filter((v) => v.kind === "line");
  if (first) adoptSong({ v: NuSong.VERSION, bpm: DOC.time.bpm, genres: {},
    slots: [lines[0] ? NuDocument.toPhrase(DOC, NuDocument.materialAt(lines[0], secs[0].id)) : NuSong.blank()],
    song: [{ ...NuSong.emptyBox(), stack: [{ g: GK + 0, slots: [0] }], len: secs[0].bars }] }, "lilguys");
  setBpm(DOC.time.bpm);
  setSwing(DOC.time.swing || null);
  setMeter(DOC.time.meter || null);
  setGroove(DOC.time.groove || null);
  NuDocument.slotsOf(DOC).forEach((ph, i) => { if (ph) putPhrase(i, ph); });
  const boxes = NuDocument.boxesOf(DOC, GK);
  const dparts = NuDeskDoc.deskPartsOf(DOC, GENRES);
  for (const b of boxes) b.parts = dparts;
  boxes.forEach((b, i) => {
    const ca = NuDeskDoc.cellAutoOf(DOC, GENRES, secs[i].id);
    if (ca) b.cellauto = ca;
  });
  setMaster(NuDeskDoc.masterOf(DOC));
  setBuses(NuDeskDoc.busesOf(DOC));
  SONG.length = 0; for (const b of boxes) SONG.push(b);
  commit("box"); commit("swing"); commit("transport");
  rescore();
}

/* ---------- the score, as played: who plays what, on which beat ---------- */
let SCORE = null;            // { boxes, parts: [notes[] per member], bars: [...] }
function rescore() {
  if (!plan.barCount && !plan.timeline) return;
  try {
    plan.compile();
    const TL = plan.timeline();
    if (!TL.length) { SCORE = null; return; }
    const sc = scoreOf({ timeline: TL, cast: plan.cast(), seats: plan.seats(),
                         sections: SONG, addr: plan.addrOf, bpm, grid: true });
    const seats = plan.seats();
    const parts = [[], [], [], []];
    const instrOfMember = members.map((v) => (v && v.instrument) || null);
    for (const box of sc.boxes) for (const lane of box.lanes) {
      let m = -1;
      if (lane.chair === "drums" || lane.name === "drums") m = 0;
      else if (lane.chair === "bass" || lane.name === "bass") m = 1;
      else {
        const seat = seats[+String(lane.name).replace(/^v/, "")];
        const ins = (seat && seat.instr) || lane.instr;
        m = ins && ins === instrOfMember[3] && ins !== instrOfMember[2] ? 3
          : ins && ins === instrOfMember[2] ? 2
          : seat && (seat.chair === "lead" || seat.part === "lead") ? 3 : 2;
      }
      for (const n of lane.notes) parts[m].push({ ...n, beat: n.beat + box.beat0 });
    }
    parts.forEach((p) => p.sort((a, b) => a.beat - b.beat));
    // the bars: each timeline bar's downbeat, its section's name on the first
    const bars = TL.map((b, i) => ({ n: i + 1, beat: b.beat0, beats: b.barSteps / 4,
      si: b.si, label: b.first ? roleWord(b.si) : "" }));
    SCORE = { boxes: sc.boxes, parts, bars };
    paintStaffData();
  } catch (e) {
    console.warn("lilguys: score failed", e);
    SCORE = null;
  }
}
const roleWord = (si) => {
  const s = DOC.form.sections[si];
  if (!s) return "";
  const same = DOC.form.sections.slice(0, si + 1).filter((x) => x.role === s.role).length;
  const many = DOC.form.sections.filter((x) => x.role === s.role).length;
  return (s.secname || s.role || "section") + (many > 1 ? " " + same : "");
};

/* ---------- the members: who they are, what they look like ---------- */
function lookOf(m) {
  const v = members[m];
  if (!v) return m === 0 ? LOOK.STICKS : m === 1 ? LOOK.CAP : LOOK.KEYS;
  if (m === 0) return LOOK.STICKS;
  if (m === 1) return LOOK.CAP;
  const i = v.instrument || "";
  if (/vox|voice|choir|aah|ooh|schola|cantor|singer/.test(i)) return LOOK.SINGER;
  if (/violin|fiddle|viola|cello|erhu|guitar|gtr|strat|tele|banjo|oud|sitar|lute|mandolin|koto|uke/.test(i)) return LOOK.GUITAR;
  if (/sax|trumpet|horn|brass|trombone|clarinet|flute|oboe|bassoon|tuba|whistle|pipe|recorder|harmonica|bagpipe|shakuhachi|duduk|ney/.test(i)) return LOOK.HORN;
  if (/synth|saw|square|pad|lead|moog|juno|dx|acid|303|sine|pulse|polysynth|arp|chip|bright_y/.test(i)) return LOOK.SYNTH;
  return LOOK.KEYS;
}
function bassKindOf() {
  const i = instrumentOf(1) || "";
  if (/upright|acoustic_bass|double|contrabass/.test(i)) return BASS.UPRIGHT;
  if (/vox|voice/.test(i)) return BASS.VOICE;
  if (/synth|bass_lead|sub|acid|303|moog|reese|wobble|saw|square|808/.test(i)) return BASS.SYNTH;
  return BASS.GUITAR;
}
// what a member plays: the doc's word, else the seat the engine gave it
function instrumentOf(m) {
  const v = members[m];
  if (!v) return "";
  if (v.instrument && m !== 0) return v.instrument;
  if (m === 0) return (v.instrument ? v.instrument + " kit" : "drums");
  const seat = (plan.seats() || []).find((s) => s.chair === "bass");
  return (seat && seat.instr) || "bass";
}
const pretty = (s) => String(s || "").replace(/_/g, " ").replace(/\b(\w)/g, (c) => c.toUpperCase());
function whoOf(m) {
  const v = members[m];
  if (!v) return NAMES[m];
  if (m >= 2) return String(v.name || NAMES[m]).toUpperCase();
  return NAMES[m];
}

/* ---------- the stage ---------- */
const cards = [];
let SEL = -1, MINE = -1;
function buildBand() {
  const host = $("band");
  host.replaceChildren();
  cards.length = 0;
  for (let m = 0; m < 4; m++) {
    const b = document.createElement("button");
    b.className = "member";
    b.style.setProperty("--mc", COL[m]);
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<canvas width="60" height="64"></canvas><span class="who"></span>
      <span class="inst"></span><span class="what"></span><span class="mine">YOU PLAY THIS</span>`;
    b.addEventListener("click", () => select(SEL === m ? -1 : m));
    host.appendChild(b);
    cards.push({ el: b, cv: b.querySelector("canvas"), blink: performance.now() + 1500 + m * 700 });
  }
  refreshCards();
}
function refreshCards() {
  cards.forEach((c, m) => {
    const v = members[m];
    c.el.querySelector(".who").textContent = whoOf(m);
    c.el.querySelector(".inst").textContent = v ? pretty(instrumentOf(m)) : "not in this band";
    c.el.setAttribute("aria-pressed", String(SEL === m));
    c.el.classList.toggle("yours", MINE === m);
    c.el.classList.toggle("out", !v);
    c.el.setAttribute("aria-label", `${whoOf(m)}${v ? ", " + pretty(v.instrument) : ", not in this band"}. Open its motifs.`);
  });
}

const OUT = /^(out|nodrums|nobass|tacet|rest|silent)$/;
// what a member does in a section, in a word (its development word)
function wordOf(m, si) {
  const v = members[m];
  if (!v) return "out";
  const sid = secId(si), dev = v.development || {};
  const w = dev[sid];
  if (m === 0) return w || "groove";
  if (m === 1) return w || (v.cast && v.cast.style) || "plays";
  return w || "as written";
}

// is member m sounding at beat b? (binary search over its notes)
function soundingAt(m, b) {
  if (!SCORE) return null;
  const a = SCORE.parts[m];
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].beat <= b) lo = mid + 1; else hi = mid; }
  for (let i = lo - 1; i >= 0 && i >= lo - 8; i--) {
    const n = a[i];
    if (n.beat <= b && b < n.beat + Math.max(m === 0 ? 0.12 : 0.1, n.dur)) return n;
  }
  return null;
}

const floats = [];
const wasOn = [false, false, false, false];
let lastSec = -1, bannerAt = 0;
function sectionAtBeat(b) {
  if (!SCORE) return -1;
  const bars = SCORE.bars;
  let lo = 0, hi = bars.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (bars[mid].beat <= b) lo = mid + 1; else hi = mid; }
  return lo - 1;
}

function frame(t) {
  const now = playing ? songBeatNow() : -1;
  const bi = now >= 0 ? sectionAtBeat(now) : -1;
  const bar = bi >= 0 ? SCORE.bars[bi] : null;
  const si = bar ? bar.si : -1;
  // the banner: the section, the bar in it, the beat as dots
  if (si !== lastSec) {
    lastSec = si;
    if (si >= 0) bannerAt = t;
    $("banner").querySelector(".sec").textContent = si >= 0 ? roleWord(si) + "!" : (GENRE ? titleOf(GENRE) : "");
  }
  $("banner").classList.toggle("flash", si >= 0 && t - bannerAt < 1400);
  if (bar) {
    const first = SCORE.bars.findIndex((x) => x.si === si);
    const nBars = SCORE.bars.filter((x) => x.si === si).length;
    $("banner").querySelector(".where").textContent = `bar ${bi - first + 1} of ${nBars}`;
    const beats = Math.max(1, Math.round(bar.beats)), cur = Math.floor(now - bar.beat);
    const dots = $("banner").querySelector(".dots");
    if (dots.childElementCount !== beats) dots.innerHTML = "<span></span>".repeat(beats);
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === cur));
  } else {
    $("banner").querySelector(".where").textContent = playing ? "starting…" : "press play";
    $("banner").querySelector(".dots").innerHTML = "";
  }
  const beatFrac = now >= 0 ? now - Math.floor(now) : 0;
  // the soloist (a member whose word says so) is watched by the others
  let solo = -1;
  if (si >= 0) for (let m = 0; m < 4; m++) if (/solo/.test(wordOf(m, si))) solo = m;
  cards.forEach((c, m) => {
    const cx = c.cv.getContext("2d");
    cx.fillStyle = SEL === m ? "#242430" : BG;
    cx.fillRect(0, 0, 60, 64);
    const v = members[m];
    const w = si >= 0 ? wordOf(m, si) : "";
    const n = now >= 0 ? soundingAt(m, now) : null;
    const on = !!n && MINE !== m;
    const out = !v || (si >= 0 && OUT.test(w));
    const pose = {
      mood: out ? 0 : !playing ? 1 : w === "as written" ? 2 : 1,
      note: on, hit: m === 0 && on,
      listen: SEL === m,
      flip: /upside|invert|retrograde/.test(w),
      bob: playing && !out ? (on ? 3 : beatFrac < 0.5 ? 1 : 0) : 0,
      sway: m === 1 && playing && !out ? ((Math.floor(now) & 1) ? 2 : -1) : 0,
      look: solo >= 0 && solo !== m ? (solo < m ? -1 : 1) : !playing ? (((t / 1700 | 0) + m) % 3) - 1 : 0,
      blink: false,
    };
    if (t > c.blink && t < c.blink + 120) pose.blink = true;
    else if (t >= c.blink + 120) c.blink = t + 1800 + Math.random() * 3500;
    if (solo === m) { cx.fillStyle = "#3a3628"; cx.fillRect(2, 0, 56, 52); }
    drawSprite(cx, 6, 8, m, lookOf(m), bassKindOf(), pose, t);
    if (!pose.mood) { const z = t % 1800; zee(cx, 46 + z / 300, 18 - z / 90, z >= 900, MID); }
    if (pose.mood === 2 && on && !wasOn[m]) floats.push({ m, x: 8 + Math.random() * 40, born: t });
    wasOn[m] = on;
    c.el.querySelector(".what").textContent = !v || si < 0 ? "" : OUT.test(w) ? "lays out" : w;
  });
  // the notes floating up, each over its own member
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], age = t - f.born;
    if (age > 900 || !playing) { floats.splice(i, 1); continue; }
    const cx = cards[f.m].cv.getContext("2d");
    quaver(cx, f.x + ((age / 120 | 0) % 2), 24 - age / 40, mix(COL[f.m], BG, age / 10));
  }
  // the roll's playhead: where the member's motif is, in the cell it reads now
  if (SEL >= 0 && roll && now >= 0 && bar) rollHead(now, bar, si);
  else if (roll) roll.setPlayhead(-1);
  if (!$("sheet").hidden && staff) staff.draw(now >= 0 ? now : staffRest);
  requestAnimationFrame(frame);
}

/* ---------- motifs: the cells a member reads, and the piano roll ---------- */
let roll = null, CELL = null;   // the cell open in the roll
function cellsOf(m) {
  const v = members[m];
  if (!v) return [];
  const used = new Map();     // cell name -> [section indexes]
  DOC.form.sections.forEach((s, i) => {
    const name = NuDocument.materialAt(v, s.id);
    if (!name || !DOC.material.cells[name]) return;
    if (!used.has(name)) used.set(name, []);
    used.get(name).push(i);
  });
  return [...used.entries()].map(([name, secs]) => ({ name, secs }));
}

// a cell another member also reads gets its own copy before it is edited, so
// writing the lead's hook does not rewrite the keys' riff
function ownCell(m, name) {
  const v = members[m];
  const shared = DOC.voices.some((o) => o !== v && o.material != null &&
    (typeof o.material === "string" ? o.material === name : Object.values(o.material).includes(name)));
  if (!shared) return name;
  let nn = name + "·" + whoOf(m).toLowerCase(), k = 2;
  while (DOC.material.cells[nn]) nn = name + "·" + whoOf(m).toLowerCase() + k++;
  DOC.material.cells[nn] = JSON.parse(JSON.stringify(DOC.material.cells[name]));
  if (typeof v.material === "string") v.material = nn;
  else for (const key of Object.keys(v.material)) if (v.material[key] === name) v.material[key] = nn;
  if (CELL === name) CELL = nn;
  return nn;
}

const PC_NAME_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const PC_NAME_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
function modeSteps() {
  const A = DOC.alphabet || {};
  return MODES[A.mode] || MODES.ionian || [0, 2, 4, 5, 7, 9, 11];
}
const tonicPc = () => (((DOC.alphabet && DOC.alphabet.key) || 0) % 12 + 12) % 12;
const MODE_TO_MAJOR = { ionian: 0, dorian: -2, phrygian: -4, lydian: -5, mixolydian: -7, aeolian: -9, locrian: -11 };
function sigOf() {
  const A = DOC.alphabet || {};
  return keySig(tonicPc(), MODE_TO_MAJOR[A.mode] || 0);
}
function degName(d) {
  const st = modeSteps(), n = st.length;
  const o = Math.floor(d / n), i = ((d % n) + n) % n;
  const pc = (tonicPc() + st[i]) % 12;
  const name = (sigOf() < 0 ? PC_NAME_FLAT : PC_NAME_SHARP)[pc];
  return name + (o > 0 ? "'".repeat(o) : o < 0 ? ",".repeat(-o) : "");
}

const DRUM_ROWS = [["x", "crash"], ["r", "ride"], ["o", "open hat"], ["h", "hat"], ["f", "pedal hat"],
  ["t", "tom hi"], ["m", "tom mid"], ["l", "tom lo"], ["c", "clap"], ["p", "rim"], ["s", "snare"], ["k", "kick"]];
const DRUM_SHORT = { x: "crash", r: "ride", o: "open", h: "hat", f: "pedal", t: "tom 1", m: "tom 2", l: "tom 3", c: "clap", p: "rim", s: "snare", k: "kick" };

function stepsPerBar() {
  try { return K.stepsIn(GENRES[GK + 0]) / (GENRES[GK + 0].rate || 1) || 16; } catch (e) { return 16; }
}

function openCell(m, name) {
  CELL = name;
  const c = DOC.material.cells[name];
  const bar = Math.round(stepsPerBar()) || 16;
  const beat = bar % 3 === 0 && bar !== 12 ? 3 : (DOC.time.meter === "six" ? 3 : 4);
  if (c.kind === "drum") {
    const steps = Math.max(...Object.values(c.lanes).map((a) => a.length), 16);
    const rows = DRUM_ROWS.map(([k, label]) => ({ key: k, label: DRUM_SHORT[k] || label,
      scale: !!c.lanes[k], tonic: k === "k" || k === "s" }));
    const notes = [];
    for (const [k, a] of Object.entries(c.lanes)) {
      if (!/^[a-z]$/.test(k)) continue;
      a.forEach((x, i) => { if (x) notes.push({ at: i, len: 1, row: k, acc: x >= 7 ? 1 : 0 }); });
    }
    roll.set({ rows, notes, steps, beat, bar, color: COL[m], drum: true });
    roll.el.scrollTop = 0;
  } else {
    const steps = c.deg.length;
    const notes = [];
    let lo = 0, hi = 7;
    for (let i = 0; i < steps; i++) {
      if (c.play[i] !== "n") continue;
      let len = 1;
      while (i + len < steps && c.play[i + len] === "h") len++;
      const d = c.deg[i] | 0;
      lo = Math.min(lo, d); hi = Math.max(hi, d);
      notes.push({ at: i, len, row: d, acc: c.acc && c.acc[i] ? 1 : 0 });
    }
    const n = modeSteps().length;
    const top = Math.max(hi + 3, n * 2), bot = Math.min(lo - 3, -n);
    const rows = [];
    for (let d = top; d >= bot; d--)
      rows.push({ key: d, label: degName(d), scale: true, tonic: ((d % n) + n) % n === 0 });
    roll.set({ rows, notes, steps, beat, bar, color: COL[m], drum: false });
    roll.scrollToRow(Math.round((lo + hi) / 2));
  }
  [...$("motifTabs").children].forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cell === name)));
}

function writeCell(m, notes) {
  if (m === 1 && pendingBass) { members[1].material = CELL; pendingBass = false; }
  const name = ownCell(m, CELL);
  const c = DOC.material.cells[name];
  if (c.kind === "drum") {
    const steps = Math.max(...Object.values(c.lanes).map((a) => a.length), 16);
    for (const k of Object.keys(c.lanes)) if (/^[a-z]$/.test(k)) c.lanes[k] = new Array(c.lanes[k].length).fill(0);
    for (const n of notes) {
      if (!c.lanes[n.row]) c.lanes[n.row] = new Array(steps).fill(0);
      c.lanes[n.row][n.at] = n.acc ? 8 : 1;
    }
    for (const k of Object.keys(c.lanes)) if (/^[a-z]$/.test(k) && !c.lanes[k].some(Boolean)) delete c.lanes[k];
    if (!Object.keys(c.lanes).length) c.lanes.k = new Array(steps).fill(0);
  } else {
    const L = c.deg.length;
    const old = { deg: c.deg.slice(), vel: c.vel ? c.vel.slice() : null };
    // one line: a later note cuts a held one short; two on one step, the higher
    const byAt = new Map();
    for (const n of notes) { const o = byAt.get(n.at); if (!o || n.row > o.row) byAt.set(n.at, n); }
    const line = [...byAt.values()].sort((a, b) => a.at - b.at);
    c.play = new Array(L).fill("r");
    c.deg = new Array(L).fill(0);
    if (c.vel) c.vel = new Array(L).fill(6);
    if (c.acc) c.acc = new Array(L).fill(0);
    for (const f of ["sld", "art", "alt"]) if (Array.isArray(c[f])) c[f] = new Array(L).fill(0);
    line.forEach((n, j) => {
      const end = Math.min(L, n.at + n.len, j + 1 < line.length ? line[j + 1].at : L);
      c.play[n.at] = "n"; c.deg[n.at] = n.row;
      for (let i = n.at + 1; i < end; i++) { c.play[i] = "h"; c.deg[i] = n.row; }
      if (c.vel) c.vel[n.at] = n.acc ? 8 : (old.vel && old.deg[n.at] === n.row ? old.vel[n.at] : 6) || 6;
      if (c.acc) c.acc[n.at] = n.acc ? 1 : 0;
    });
    // a line of nothing still has to be a cell: one rest is fine
  }
  push(false);
  say(`${whoOf(m).toLowerCase()}: ${name} changed — the band plays it ${playing ? "in a few seconds" : "when you press play"}`);
  if (SEL === m) { renderTabs(m); openCell(m, name); }
}

function renderTabs(m) {
  const host = $("motifTabs");
  host.replaceChildren();
  for (const { name, secs } of cellsOf(m)) {
    const b = document.createElement("button");
    b.dataset.cell = name;
    b.setAttribute("role", "tab");
    const where = secs.map((i) => roleWord(i));
    b.textContent = name;
    b.title = "played in " + where.join(", ");
    b.addEventListener("click", () => openCell(m, name));
    host.appendChild(b);
  }
}

function select(m) {
  SEL = m;
  refreshCards();
  const drawer = $("drawer");
  if (m < 0 || !members[m]) {
    drawer.hidden = true;
    if (m >= 0) say(`${NAMES[m].toLowerCase()} sits this genre out`);
    SEL = m >= 0 && !members[m] ? -1 : SEL;
    refreshCards();
    showSheet();
    return;
  }
  drawer.hidden = false;
  drawer.style.setProperty("--mc", COL[m]);
  $("drawerTitle").textContent = `${whoOf(m)} · ${pretty(instrumentOf(m))}`;
  $("mine").checked = MINE === m;
  const cells = cellsOf(m);
  $("drawerHint").textContent = m === 0
    ? "The drummer's pattern, a lane a row. Shift-click a hit to accent it. Each section plays it its own way (busier, half time, a fill)."
    : m === 1 && !cells.length
      ? "The bass plays the genre's line over the chords. Write notes here and it plays yours instead (rows are the song's scale)."
      : "Rows are the song's scale (in key, always); the band moves your motif with the chords and develops it section by section.";
  renderTabs(m);
  if (m === 1 && !cells.length) {
    // a written bass: a cell of its own, empty, read in every section
    const steps = Math.round(stepsPerBar()) * 2 || 32;
    const name = "bassline";
    if (!DOC.material.cells[name]) DOC.material.cells[name] = { kind: "line",
      deg: new Array(steps).fill(0), play: new Array(steps).fill("r"),
      vel: new Array(steps).fill(6), acc: new Array(steps).fill(0) };
    CELL = name;
    pendingBass = true;
    openCell(m, name);
  } else {
    pendingBass = false;
    const now = playing ? songBeatNow() : -1;
    const bi = now >= 0 ? sectionAtBeat(now) : -1;
    const si = bi >= 0 ? SCORE.bars[bi].si : 0;
    const cur = cells.find((c) => c.secs.includes(si)) || cells[0];
    openCell(m, cur.name);
  }
  showSheet();
  drawer.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
let pendingBass = false;

function rollHead(now, bar, si) {
  const v = members[SEL];
  if (!v) return;
  const name = NuDocument.materialAt(v, secId(si));
  if (name !== CELL) { roll.setPlayhead(-1); return; }
  const c = DOC.material.cells[name];
  const L = c.kind === "drum" ? Math.max(...Object.values(c.lanes).map((a) => a.length), 16) : c.deg.length;
  const first = SCORE.bars.find((x) => x.si === si);
  const steps = (now - first.beat) * 4;
  roll.setPlayhead(((steps % L) + L) % L);
}

/* ---------- mute: "I'll play this part" ---------- */
function setMine(m, yes) {
  for (let k = 0; k < 4; k++) {
    const v = members[k];
    if (!v) continue;
    const want = yes && k === m;
    const d = { ...(v.desk || {}) };
    if (want) d.mute = true; else delete d.mute;
    v.desk = Object.keys(d).length ? d : undefined;
    if (!v.desk) delete v.desk;
  }
  MINE = yes ? m : -1;
  push(false);
  refreshCards();
  showSheet();
  if (yes) say(`${whoOf(m).toLowerCase()} is muted — the part is yours${playing ? " (from a few seconds on)" : ""}`);
  else say("everyone plays");
}

/* ---------- the staff ---------- */
let staff = null, staffRest = -0.001;
function showSheet() {
  const m = MINE >= 0 ? MINE : SEL;
  const sheet = $("sheet");
  if (m < 0 || !members[m]) { sheet.hidden = true; return; }
  sheet.hidden = false;
  $("sheetTitle").textContent = MINE === m
    ? `Your part: ${whoOf(m).toLowerCase()} (${pretty(instrumentOf(m))}) — muted in the band`
    : `${whoOf(m).toLowerCase()} — as played (tick "I'll play this part" to mute it and play along)`;
  paintStaffData();
}
function paintStaffData() {
  if (!staff || !SCORE) return;
  const m = MINE >= 0 ? MINE : SEL;
  if (m < 0) return;
  const notes = SCORE.parts[m].map((n) => ({ beat: n.beat, dur: n.dur, midi: n.midi }));
  let clef = "treble";
  if (m === 0) clef = "drums";
  else {
    const ms = notes.map((n) => n.midi).sort((a, b) => a - b);
    const med = ms.length ? ms[ms.length >> 1] : 64;
    const lo = ms.length ? ms[Math.floor(ms.length * 0.05)] : 60, hi = ms.length ? ms[Math.floor(ms.length * 0.95)] : 70;
    clef = m === 1 ? "bass" : lo < 53 && hi > 67 ? "grand" : med < 57 ? "bass" : "treble";
  }
  $("staff").classList.toggle("grand", clef === "grand");
  staff.set({ notes, bars: SCORE.bars, sig: m === 0 ? 0 : sigOf(), color: COL[m], clef, drumLanes: drumPos });
  const A = DOC.alphabet || {};
  $("legend").textContent = m === 0
    ? "Drums: the kick under the staff, the snare in the middle, cymbals as crosses above."
    : `Key of ${degName(0)} ${A.mode || ""} · ${Math.round(bpm)} BPM · the note under the line is the one sounding; the pale bar is how long it is held.`;
}
// a drum's place on the staff (half-spaces from the top line) and whether it is a cross
function drumPos(n) {
  const k = n.midi;
  if (k === 35 || k === 36) return { pos: 7, x: false };
  if (k === 38 || k === 40) return { pos: 3, x: false };
  if (k === 37 || k === 39) return { pos: 3, x: true };
  if (k === 42 || k === 46) return { pos: -1, x: true };
  if (k === 44) return { pos: 9, x: true };
  if (k === 49 || k === 57 || k === 55 || k === 52) return { pos: -2, x: true };
  if (k === 51 || k === 59 || k === 53) return { pos: 0, x: true };
  if (k === 48 || k === 50) return { pos: 1, x: false };
  if (k === 45 || k === 47) return { pos: 2, x: false };
  if (k === 41 || k === 43) return { pos: 5, x: false };
  return { pos: 4, x: true };
}

/* ---------- the transport and the tempo ---------- */
function say(text) { $("status").textContent = text; }
const titleOf = (gk) => {
  const g = GENRES[gk] || {};
  const name = NuWiki && NuWiki.name ? NuWiki.name(gk) : null;
  return name ? `${name}${g.label ? " · " + g.label : ""}` : (g.label || gk);
};

function setTempo(v, quiet) {
  v = Math.max(40, Math.min(220, Math.round(v)));
  DOC.time.bpm = v;
  $("tempo").value = v;
  const pct = Math.round(100 * v / GENRE_BPM);
  $("tempoOut").textContent = `${v} BPM` + (pct !== 100 ? ` (${pct}%)` : "");
  if (quiet) return;
  push(false);
  if (playing) say(`tempo ${v} — the band takes it in a few seconds`);
}

async function loadGenre(gk, seed) {
  const was = playing;
  if (was) stop();
  GENRE = gk; SEED = seed;
  DOC = NuPrecompose.genreToDocument(gk, seed);
  trimBand(DOC);
  GENRE_BPM = DOC.time.bpm;
  MINE = -1;
  setLoopOnly(null); $("loopSec").checked = false;
  setTempo(GENRE_BPM, true);
  push(true);
  $("genre").value = titleOf(gk);
  document.title = `${titleOf(gk)} — Stellate Lilguys`;
  history.replaceState(null, "", `#g=${encodeURIComponent(gk)}&s=${seed}`);
  buildBand();
  select(-1);
  lastSec = -2;
  say(`${titleOf(gk)}: ${members.filter(Boolean).length} play. Click one to open its motifs.`);
  warmup();
  if (was) startAt(0);
}

let ANCHORS = [];
function genreList() {
  ANCHORS = (NuPrecompose.anchors ? NuPrecompose.anchors() : Object.keys(GENRES))
    .filter((k) => GENRES[k] && !GENRES[k].silent && !String(k).startsWith("lab."));
  const dl = $("genres");
  dl.innerHTML = ANCHORS.map((k) => `<option value="${titleOf(k).replace(/"/g, "&quot;")}"></option>`).join("");
}
function genreFromText(s) {
  const q = String(s || "").trim().toLowerCase();
  if (!q) return null;
  return ANCHORS.find((k) => titleOf(k).toLowerCase() === q) || ANCHORS.find((k) => k === q)
    || ANCHORS.find((k) => titleOf(k).toLowerCase().includes(q)) || null;
}

async function boot() {
  setRubato(false);          // a grid you can play along with: no tempo map
  roll = new Roll($("roll"), { onChange: (notes) => { if (SEL >= 0) writeCell(SEL, notes); } });
  staff = new Staff($("staff"));
  genreList();
  say("warming the engine…");
  await plan.warmEngine();
  const h = new URLSearchParams(location.hash.slice(1));
  const gk = h.get("g") && GENRES[h.get("g")] ? h.get("g") : (ANCHORS.includes("funk") ? "funk" : ANCHORS[1]);
  await loadGenre(gk, +h.get("s") || 1);
  $("play").disabled = false;
  $("play").addEventListener("click", () => {
    if (playing) { stop(); return; }
    say("starting the band… (the engine fills its buffer first)");
    startAt(loopOnly != null ? loopOnly : 0);
  });
  on("transport:state", ({ playing: p }) => {
    $("play").textContent = p ? "stop" : "play";
    $("play").setAttribute("aria-pressed", String(!!p));
    if (!p) { staffRest = -0.001; lastSec = -2; }
  });
  on("status", (d) => { if (d && d.text && /filling|starting|engine|dropout/i.test(d.text)) say(d.text); });
  on("pos", () => { if (/starting|filling/.test($("status").textContent)) say(`${titleOf(GENRE)} — playing`); });
  $("dice").addEventListener("click", () => {
    const pick = ANCHORS[1 + Math.floor(Math.random() * (ANCHORS.length - 1))];
    loadGenre(pick, 1 + Math.floor(Math.random() * 65535));
  });
  $("genre").addEventListener("change", (e) => {
    const gk2 = genreFromText(e.target.value);
    // (the box fires again when it loses focus: the genre it already shows is no change)
    if (gk2 === GENRE) { e.target.value = titleOf(GENRE); return; }
    if (gk2) { loadGenre(gk2, 1); e.target.blur(); } else say("no genre by that name — try another word");
  });
  $("genre").addEventListener("focus", (e) => e.target.select());
  $("tempo").addEventListener("input", (e) => setTempo(+e.target.value, true));
  $("tempo").addEventListener("change", (e) => setTempo(+e.target.value));
  $("tempoBack").addEventListener("click", () => setTempo(GENRE_BPM));
  $("closeDrawer").addEventListener("click", () => select(-1));
  $("mine").addEventListener("change", (e) => { if (SEL >= 0) setMine(SEL, e.target.checked); });
  $("loopSec").addEventListener("change", (e) => {
    const now = playing ? songBeatNow() : -1;
    const bi = now >= 0 ? sectionAtBeat(now) : -1;
    const si = bi >= 0 ? SCORE.bars[bi].si : 0;
    setLoopOnly(e.target.checked ? si : null);
    push(false);
    say(e.target.checked ? `looping ${roleWord(si)}` : "the whole song again");
    if (playing) { stop(); startAt(e.target.checked ? si : si); }
  });
  // the keyboard: space plays, 1-4 open a member
  window.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); $("play").click(); }
    else if (/^Digit[1-4]$/.test(e.code)) select(+e.code.slice(5) - 1);
    else if (e.code === "Escape") select(-1);
  });
  requestAnimationFrame(frame);
}

window.__lil = { get DOC() { return DOC; }, get SCORE() { return SCORE; }, members: () => members, plan,
  loadGenre, select, setMine, setTempo, songBeatNow, getPosition };
boot().catch((e) => { console.error(e); say("could not start: " + (e && e.message || e)); });
