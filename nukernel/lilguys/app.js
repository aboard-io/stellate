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
import { startAt, stop, playing, warmup, songBeatNow, getPosition, engineHandle } from "../audio/live.js";
import * as plan from "../audio/plan.js";
import { scoreOf } from "../export/score.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";
import { drawSprite, quaver, zee, COL, BG, INK, MID, LOOK, BASS, mix } from "./sprites.js";
import { Roll } from "./roll.js";
import { Judge, Listener } from "./listen.js";
import { Staff } from "./staff.js";
import { chordName } from "../ui/paper.js";

const $ = (id) => document.getElementById(id);
// asked before the first genre rewrites the address
const FUZZ = /(^|[#&])fuzz\b/.test(location.hash) ? new URLSearchParams(location.hash.slice(1)) : null;
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
  return [drums, bass, keys, lead];
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
    const parts = [[], [], [], []];
    // WHO PLAYED IT: the section's own address (unit -> desk chair) and the
    // desk's chair -> voice, the same road the mute takes. Not the instrument
    // and not the lane's label: in ragtime one honky-tonk unit is the lead in
    // the intro and the riff in the verse, and both guesses gave the lead's
    // notes to the keys (the fuzzer's mute-cuts found it).
    const chanVoice = new Map(NuDeskDoc.channelVoicesOf(DOC, GENRES).map((c) => [c.key, c.voice]));
    const cs = hasCount() ? countSi() : -1;
    for (const box of sc.boxes) {
      if (box.si === cs) continue;
      const A = plan.addrOf(box.si) || {};
      for (const lane of box.lanes) {
        let m = -1;
        if (lane.name === "drums" || A[lane.name] === "drums") m = 0;
        else {
          const v = chanVoice.get(A[lane.name]);
          m = v ? members.indexOf(v) : -1;
          if (m < 0) m = lane.chair === "bass" ? 1 : -1;
        }
        if (m < 0) continue;                 // a layer with no chair of its own
        for (const n of lane.notes) parts[m].push({ ...n, beat: n.beat + box.beat0 });
      }
    }
    parts.forEach((p) => p.sort((a, b) => a.beat - b.beat));
    // the bars: each timeline bar's downbeat, its section's name on the first
    const bars = TL.filter((b) => b.si !== cs).map((b, i) => ({ n: i + 1, beat: b.beat0, beats: b.barSteps / 4,
      si: b.si, label: b.first ? roleWord(b.si) : "" }));
    chordsOnto(bars);
    SCORE = { boxes: sc.boxes, parts, bars };
    paintStaffData();
  } catch (e) {
    console.warn("lilguys: score failed", e);
    SCORE = null;
  }
}
// THE CHANGES OVER THE BARS: document.js chordsIn says which degree and
// quality each bar is on; ui/paper.js chordName (the band score's own speller)
// says what a copyist writes for it.
function chordSymbol(c) {
  if (!c || c.deg == null) return "";
  const A = DOC.alphabet || {};
  try { return chordName(c.deg | 0, c.q || "triad", A.key | 0, MODES[A.mode] || MODES.aeolian); } catch (e) { return ""; }
}
function chordsOnto(bars) {
  try {
    const all = NuDocument.chordsIn(DOC, GENRES).chords;
    const per = (NuDocument.barsOf ? NuDocument.barsOf(DOC) : 1) || 1;
    const bar0 = [];                    // each section's first bar, in the song's own count
    let acc = 0;
    DOC.form.sections.forEach((s, i) => { bar0[i] = acc; acc += s.bars * per; });
    const at = new Map();
    for (const c of all) { const a = at.get(c.bar) || []; a.push(c); at.set(c.bar, a); }
    let last = "";
    const seen = new Map();             // section -> bars of it met so far (the timeline may loop one)
    for (const b of bars) {
      const k = seen.get(b.si) || 0; seen.set(b.si, k + 1);
      const cs = (at.get(bar0[b.si] + k) || []).sort((x, y) => x.from - y.from);
      const one = chordSymbol(cs[0]), two = chordSymbol(cs[1]);
      b.chord = one && one !== last ? one : "";
      b.chord2 = two && two !== (one || last) ? two : "";
      last = two || one || last;
    }
  } catch (e) { /* no chords is a staff without symbols, not an error */ }
}
const roleWord = (si) => {
  const s = DOC.form.sections[si];
  if (!s) return "";
  if (s.id === "count") return "count-in";
  const same = DOC.form.sections.slice(0, si + 1).filter((x) => x.role === s.role).length;
  const many = DOC.form.sections.filter((x) => x.role === s.role).length;
  return (s.secname || s.role || "section") + (many > 1 ? " " + same : "");
};

/* ---------- the clock the eye reads ----------
   songBeatNow() is the engine's clock, which runs ahead of what the ear gets by
   the output's own latency — tens of milliseconds on a laptop, 150 to 250 on
   Bluetooth headphones — and on a phone's media route by however late its poll
   is. For reading along that is the difference between a red note
   and a note already gone, so the eye's clock is the engine's, less the
   latency the context reports, less the reader's own nudge (SYNC). */
const prefs = Object.assign({ ahead: 2, names: false, chords: true, sync: 0, mute: true, countIn: true },
  (() => { try { return JSON.parse(localStorage.getItem("lilguys.read.v1")) || {}; } catch (e) { return {}; } })());
const savePrefs = () => { try { localStorage.setItem("lilguys.read.v1", JSON.stringify(prefs)); } catch (e) {} };
function latencySec() {
  try {
    const ctx = engineHandle() && engineHandle().ctx;
    const l = ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
    return Number.isFinite(l) ? Math.min(0.5, l) : 0;
  } catch (e) { return 0; }
}
let COUNTING = null;     // during the count-in: its beat, 0.. (null otherwise)
function beatNow() {
  const b = songBeatNow();
  COUNTING = null;
  if (b < 0) return -1;
  const v = Math.max(0, b - (latencySec() + prefs.sync / 1000) * bpm / 60);
  const c = countSpan();
  // (decided on the engine's own clock: the latency taken off would put the
  // count's first instant a hair into the song's last bar, for one frame)
  if (c && b >= c.beat0 - 1e-6) { COUNTING = Math.max(0, Math.min(c.beats, v - c.beat0)); return -1; }   // not the song yet
  return v;
}

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
    b.addEventListener("click", () => {
      if (READ) { if (members[m]) { PART = m; applyReadPart(); } return; }   // reading: whose part
      select(SEL === m ? -1 : m);
    });
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
  if (sid === COUNT_ID) return m === 0 ? "counts in" : "ready";
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
  const now = playing ? beatNow() : -1;
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
  } else if (COUNTING != null) {
    $("banner").querySelector(".where").textContent = "count-in";
    const c = countSpan(), beats = c ? Math.round(c.beats) : 4, dots = $("banner").querySelector(".dots");
    if (dots.childElementCount !== beats) dots.innerHTML = "<span></span>".repeat(beats);
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === Math.floor(COUNTING)));
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
  if (!$("sheet").hidden && staff) {
    const w = !playing || now >= 0 ? "" : COUNTING != null ? `count-in: ${Math.floor(COUNTING) + 1}` : "the band is getting ready…";
    if (w !== staff.opts.waiting) staff.options({ waiting: w });
    judgeFrame(now);
    if (COUNTING != null && now < 0) { const c = countSpan(); staff.draw(-(c ? c.beats - COUNTING : 0)); }
    staff.draw(now >= 0 ? now : staffRest);
  }
  requestAnimationFrame(frame);
}

/* ---------- motifs: the cells a member reads, and the piano roll ---------- */
let roll = null, CELL = null;   // the cell open in the roll
function cellsOf(m) {
  const v = members[m];
  if (!v) return [];
  const used = new Map();     // cell name -> [section indexes]
  DOC.form.sections.forEach((s, i) => {
    if (s.id === COUNT_ID) return;
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
// sharps (+) or flats (-) by the relative major's pitch class: only which way
// the roll's labels spell (the staff's signature is ui/abc.js's own)
const SIG_OF_MAJOR = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
const keySig = (pc, off) => SIG_OF_MAJOR[(((pc + off) % 12) + 12) % 12];
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
  persist();
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
function setMine(m, yes, quiet) {
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
  syncCount();
  push(false);
  persist();
  refreshCards();
  showSheet();
  if (quiet) return;
  if (playing) restartHere();
  if (yes) say(`${whoOf(m).toLowerCase()} is muted — the part is yours`);
  else say("everyone plays");
}

/* ---------- the staff ---------- */
let staff = null, staffRest = -0.001;
const shownPart = () => (READ ? PART : MINE >= 0 ? MINE : SEL);
function showSheet() {
  const m = shownPart();
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
  const m = shownPart();
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
  const A0 = DOC.alphabet || {};
  staff.set({ notes, bars: SCORE.bars, key: A0.key | 0, mode: MODES[A0.mode] || MODES.aeolian,
              meter: DOC.time.meter || null, clef });
  if (READ) paintRail();
  if (LISTEN) makeJudge();
  $("legend").textContent = m === 0
    ? "Drums: the kick in the bottom space, the snare in the third, cymbals as crosses above; the red notes are sounding."
    : `Key of ${degName(0)} ${A0.mode || ""} · ${Math.round(bpm)} BPM · the red note is the one sounding.`;
}
/* ---------- READ: the staff, the whole screen, for sight reading ----------
   Built for a phone held sideways: the band shrinks to a strip along the top,
   a rail of thumb-sized buttons sits down one side (the notch's, where the
   music cannot use the room anyway), and the staff takes everything else, the
   line well to the left so most of the width is music still to come. "New
   piece" keeps the genre and the part and rolls the dice: reading practice
   wants music you have not seen. */
let READ = false, PART = 3, wake = null;
function firstPart(pref) {
  for (const m of [pref, 3, 2, 1, 0]) if (m >= 0 && members[m]) return m;
  return -1;
}
async function holdScreen(on) {   // keep the phone awake while you read (Screen Wake Lock, iOS 16.4+)
  try {
    if (on && !wake && navigator.wakeLock && document.visibilityState === "visible") {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => { wake = null; });
    } else if (!on && wake) { const w = wake; wake = null; await w.release(); }
  } catch (e) { wake = null; }
}
function applyReadPart() {
  // muting is the reader's choice: play it yourself, or hear it while you learn it
  const was = MINE;
  if (prefs.mute) setMine(PART, true, true);
  else if (MINE >= 0) setMine(MINE, false, true);
  if (playing && MINE !== was) restartHere();
  showSheet();
}
function enterRead(part) {
  PART = firstPart(part != null ? part : MINE >= 0 ? MINE : SEL >= 0 ? SEL : 3);
  if (PART < 0) { say("nobody in this band to read"); return; }
  READ = true;
  document.body.classList.add("reading");
  $("rail").hidden = false;
  staff.options({ head: 0.16, ahead: prefs.ahead, names: prefs.names, chords: prefs.chords });
  applyReadPart();
  turnHint();
  holdScreen(true);
  window.scrollTo(0, 0);
}
function exitRead() {
  READ = false;
  document.body.classList.remove("reading");
  $("rail").hidden = true;
  $("ropts").hidden = true;
  $("turn").hidden = true;
  staff.options({ head: 0.28, ahead: null, names: prefs.names, chords: prefs.chords });
  holdScreen(false);
  refreshCards();
  showSheet();
}
function paintRail() {
  if (!DOC) return;
  $("rPlay").textContent = playing ? "stop" : "play";
  $("rPlay").setAttribute("aria-pressed", String(!!playing));
  const v = Math.round(DOC.time.bpm), pct = Math.round(100 * v / GENRE_BPM);
  $("rBpm").textContent = `${v}` + (pct !== 100 ? ` · ${pct}%` : "");
  $("rPart").textContent = PART >= 0 ? whoOf(PART).toLowerCase() : "part";
  $("rPart").style.setProperty("--mc", COL[Math.max(0, PART)]);
}
// a phone held upright: the staff would be four bars of a postage stamp
const portraitPhone = () => matchMedia("(orientation: portrait) and (max-width: 700px)").matches;
let turnDismissed = false;
function turnHint() { $("turn").hidden = !(READ && portraitPhone() && !turnDismissed); }
function nudgeTempo(d) { setTempo(DOC.time.bpm + d); paintRail(); }
function newPiece() {
  const keep = PART;
  loadGenre(GENRE, 1 + Math.floor(Math.random() * 65535)).then(() => {
    if (!READ) return;
    PART = firstPart(keep);
    applyReadPart();
    say(`a new piece in ${titleOf(GENRE)} — first time through: read it`);
  });
}
function cyclePart() {
  for (let k = 1; k <= 4; k++) {
    const m = (PART + k) % 4;
    if (members[m]) { PART = m; applyReadPart(); return; }
  }
}
function wireRead() {
  $("readBtn").addEventListener("click", () => (READ ? exitRead() : enterRead()));
  $("rExit").addEventListener("click", exitRead);
  $("rPlay").addEventListener("click", () => $("play").click());
  $("rSlower").addEventListener("click", () => nudgeTempo(-5));
  $("rFaster").addEventListener("click", () => nudgeTempo(+5));
  $("rNew").addEventListener("click", newPiece);
  $("rPart").addEventListener("click", cyclePart);
  $("rOpts").addEventListener("click", () => { $("ropts").hidden = !$("ropts").hidden; });
  $("turnOk").addEventListener("click", () => { turnDismissed = true; turnHint(); });
  const ro = $("ropts");
  ro.querySelectorAll("input[name=ahead]").forEach((r) => { r.checked = +r.value === prefs.ahead; });
  $("oNames").checked = prefs.names; $("oChords").checked = prefs.chords; $("oMute").checked = prefs.mute;
  $("oCount").checked = prefs.countIn;
  $("oSync").value = prefs.sync; $("oSyncOut").textContent = `${prefs.sync} ms`;
  ro.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "ahead") prefs.ahead = +t.value;
    if (t.id === "oNames") prefs.names = t.checked;
    if (t.id === "oChords") prefs.chords = t.checked;
    if (t.id === "oMute") { prefs.mute = t.checked; if (READ) applyReadPart(); }
    if (t.id === "oCount") { prefs.countIn = t.checked; if (syncCount()) push(false); }
    savePrefs();
    staff.options({ ahead: READ ? prefs.ahead : null, names: prefs.names, chords: prefs.chords });
  });
  $("oSync").addEventListener("input", (e) => {
    prefs.sync = +e.target.value; $("oSyncOut").textContent = `${prefs.sync} ms`; savePrefs();
  });
  addEventListener("resize", turnHint);
  addEventListener("orientationchange", turnHint);
  document.addEventListener("visibilitychange", () => { if (READ && document.visibilityState === "visible") holdScreen(true); });
}

// the reading options back to these (the fuzzer's fresh start), boxes and staff with them
function resetPrefs(p) {
  Object.assign(prefs, p);
  document.querySelectorAll("#ropts input[name=ahead]").forEach((r) => { r.checked = +r.value === prefs.ahead; });
  $("oNames").checked = prefs.names; $("oChords").checked = prefs.chords; $("oMute").checked = prefs.mute;
  $("oCount").checked = prefs.countIn;
  $("oSync").value = prefs.sync; $("oSyncOut").textContent = `${prefs.sync} ms`;
  $("ropts").hidden = true; turnDismissed = false;
  staff.options({ ahead: READ ? prefs.ahead : null, names: prefs.names, chords: prefs.chords });
}

/* ---------- LISTENING: what you play, against the part (lilguys/listen.js) ----
   A MIDI keyboard's notes are judged against the part on the staff, on the
   eye's own clock (beatNow: latency and the reader's nudge already taken
   off), so you are judged against what you hear. A hit turns its note green,
   a note gone by unplayed turns orange, and a tally keeps count. The judge is
   made again whenever the part is (a new part, a new piece, an edit) and
   rewinds when the clock does (a loop coming round, a restart from a bar). */
let LISTEN = false, judge = null, listener = null, judgedTo = -1;
const winBeats = () => Math.max(0.06, 0.12 * bpm / 60);     // ±120 ms, in beats
function makeJudge() {
  judge = null; judgedTo = -1;
  if (staff) staff.clearMarks();
  const m = shownPart();
  if (LISTEN && SCORE && m >= 0 && members[m]) {
    const seen = new Set();
    const notes = SCORE.parts[m].filter((n) => { const k = n.midi + "@" + Math.round(n.beat * 4); if (seen.has(k)) return false; seen.add(k); return true; });
    judge = new Judge(notes, { drums: m === 0 });
  }
  paintTally();
}
function paintTally() {
  const t = !LISTEN ? "" : !judge ? "listening…"
    : judge.total + judge.extra === 0 ? "listening: play along"
    : `${judge.hits} right · ${judge.misses} missed · ${judge.extra} extra` +
      (judge.total ? ` (${Math.round(100 * judge.hits / judge.total)}%)` : "");
  $("tally").textContent = t;
  // the rail is 140 px on a phone held sideways: the short form, or it pushes the buttons off the screen
  $("rTally").textContent = !LISTEN ? "" : !judge || judge.total + judge.extra === 0 ? "listening"
    : `${judge.total ? Math.round(100 * judge.hits / judge.total) + "% · " : ""}${judge.hits}/${judge.total}` + (judge.extra ? ` +${judge.extra}` : "");
  $("rTally").title = t;
}
function judgeFrame(now) {
  if (!judge || now < 0 || !playing) return;
  if (judgedTo >= 0 && now < judgedTo - 0.5) {          // the clock went back: a loop, a restart
    judge.rewind(now);
    for (const [step] of [...staff.marks]) if (step / 4 >= now - 1e-6) staff.marks.delete(step);
    staff.clearMarks(); for (const n of judge.notes) if (n.state) staff.mark(n.beat, n.state === 1 ? "hit" : "miss");
  }
  judgedTo = now;
  const missed = judge.sweep(now, winBeats());
  if (missed.length) { for (const n of missed) staff.mark(n.beat, "miss"); paintTally(); }
}
// a note you played: `ts` is when it happened (performance.now's clock)
function hear(midi, ts) {
  if (!judge || !playing) return null;
  const now = beatNow();
  if (now < 0) return null;
  const beat = now - Math.max(0, performance.now() - ts) / 1000 * bpm / 60;
  const n = judge.hear(midi, beat, winBeats());
  if (n) staff.mark(n.beat, "hit");
  paintTally();
  return n;
}
async function toggleListen() {
  const btns = [$("listen"), $("oListen")];
  if (LISTEN) {
    LISTEN = false; if (listener) listener.disable();
    btns.forEach((b) => { b.textContent = "listen to my keyboard"; b.setAttribute("aria-pressed", "false"); });
    makeJudge(); say("stopped listening");
    return;
  }
  if (!Listener.supported) { say("this browser has no MIDI (Safari on iPhone and iPad doesn't): Chrome or Edge on a computer can listen to your keyboard"); return; }
  try {
    listener = listener || new Listener((midi, ts) => hear(midi, ts));
    const ins = await listener.enable();
    LISTEN = true;
    btns.forEach((b) => { b.textContent = "stop listening"; b.setAttribute("aria-pressed", "true"); });
    makeJudge();
    say(ins.length ? `listening to ${ins.join(", ")}: play along` : "listening, but no MIDI keyboard is plugged in yet");
  } catch (e) { say("could not listen to MIDI: " + (e && e.message || e)); }
}

/* ---------- the invariants, from inside (the firmware's web_st_check) ----------
   What must be true of the page after anything a hand can do, asked of the
   page's own state rather than of its pixels. Null when all hold; else the
   first that does not, in words. lilguys/fuzz.js asks after every step. */
function check() {
  if (!DOC) return "no document";
  const secs = DOC.form.sections;
  if (DOC.voices.length > 4) return `the band is ${DOC.voices.length}, not four`;
  for (let m = 0; m < 4; m++) {
    const v = members[m];
    if (v && !DOC.voices.includes(v)) return `member ${m} is not a voice of the document`;
    if (v && m === 0 && v.kind !== "drums") return "the drummer is not the drums";
    if (v && m === 1 && v.kind !== "bass") return "the bassist is not the bass";
    if (v && m >= 2 && v.kind !== "line") return `member ${m} is not a line`;
  }
  for (const [name, c] of Object.entries(DOC.material.cells)) {
    if (c.kind === "drum") {
      const ls = Object.entries(c.lanes || {});
      if (!ls.length) return `drum cell ${name} has no lanes`;
      for (const [k, a] of ls) {
        if (!Array.isArray(a) || !a.length) return `drum cell ${name} lane ${k} is empty`;
        if (a.some((x) => !(x >= 0 && x <= 9))) return `drum cell ${name} lane ${k} has a level out of 0..9`;
      }
    } else {
      const L = c.deg && c.deg.length;
      if (!L) return `cell ${name} has no steps`;
      for (const f of ["play", "vel", "acc"]) if (c[f] && c[f].length !== L) return `cell ${name}: ${f} is ${c[f].length} steps, deg ${L}`;
      if (c.play.some((x) => x !== "n" && x !== "h" && x !== "r")) return `cell ${name} plays something not n/h/r`;
      if (c.deg.some((d) => !Number.isInteger(d) || d < -28 || d > 35)) return `cell ${name} has a degree out of reach`;
    }
  }
  for (const v of DOC.voices) for (const sc of secs) {
    const n = NuDocument.materialAt(v, sc.id);
    if (n && v.kind !== "bass" && !DOC.material.cells[n]) return `${v.name} reads ${n} in ${sc.id}: no such cell`;
  }
  for (let i = 0; i < secs.length; i++) if (!GENRES[GK + i]) return `section ${i} has no compiled genre`;
  if (SONG.length !== secs.length) return `the song is ${SONG.length} boxes for ${secs.length} sections`;
  const muted = members.map((v, m) => (v && v.desk && v.desk.mute ? m : -1)).filter((m) => m >= 0);
  if (muted.length > 1) return `${muted.length} members muted`;
  if ((muted[0] ?? -1) !== MINE) return `muted ${muted[0] ?? "none"} but the page says ${MINE}`;
  if (Math.round(bpm) !== Math.round(DOC.time.bpm)) return `the engine's tempo ${bpm} is not the record's ${DOC.time.bpm}`;
  if (+$("tempo").value !== Math.round(DOC.time.bpm)) return `the tempo slider says ${$("tempo").value}, the record ${DOC.time.bpm}`;
  if ($("loopSec").checked !== (loopOnly != null)) return "the loop box and the loop disagree";
  if (SCORE) {
    for (let i = 1; i < SCORE.bars.length; i++) if (!(SCORE.bars[i].beat > SCORE.bars[i - 1].beat)) return `bar ${i} does not come after bar ${i - 1}`;
    for (let m = 0; m < 4; m++) for (let i = 1; i < SCORE.parts[m].length; i++)
      if (SCORE.parts[m][i].beat < SCORE.parts[m][i - 1].beat) return `member ${m}'s notes are out of order`;
  }
  // the page shows what it says it shows
  if ($("drawer").hidden !== (SEL < 0)) return `the drawer is ${$("drawer").hidden ? "shut" : "open"} with member ${SEL} chosen`;
  if (SEL >= 0 && !members[SEL]) return `member ${SEL} is chosen and is not in the band`;
  if (SEL >= 0 && CELL && DOC.material.cells[CELL]) {
    const want = JSON.stringify(cellNotes(DOC.material.cells[CELL]));
    const have = JSON.stringify(roll.notes.map((n) => [n.at, n.len, n.row]).sort(cmp3));
    if (want !== have) return `the roll shows ${have.slice(0, 60)}, the cell ${CELL} holds ${want.slice(0, 60)}`;
  }
  const part = shownPart();
  if ($("sheet").hidden !== !(part >= 0 && members[part])) return `the staff is ${$("sheet").hidden ? "hidden" : "shown"} for part ${part}`;
  if (READ !== document.body.classList.contains("reading")) return "reading, and the page is not (or the reverse)";
  if (READ && $("rail").hidden) return "reading without the rail";
  if ($("play").textContent !== (playing ? "stop" : "play")) return `the play button says ${$("play").textContent} while ${playing ? "playing" : "stopped"}`;
  if (!playing && songBeatNow() !== -1) return "stopped, and the clock still runs";
  if (!playing && hasCount() !== (prefs.countIn && MINE >= 0 && loopOnly == null))
    return `stopped with ${hasCount() ? "a" : "no"} count-in (count ${prefs.countIn}, mine ${MINE}, loop ${loopOnly})`;
  if (DOC.form.sections.slice(0, -1).some((sc) => sc.id === COUNT_ID)) return "a count-in somewhere but the end";
  if (judge) {
    const open = judge.notes.filter((n) => n.state === 0).length;
    if (judge.hits < 0 || judge.misses < 0 || judge.extra < 0) return "the tally went below zero";
    if (judge.hits + judge.misses + open !== judge.notes.length) return `the tally counts ${judge.hits}+${judge.misses}+${open} of ${judge.notes.length} notes`;
  }
  return null;
}
const cmp3 = (a, b) => a[0] - b[0] || (typeof a[2] === "string" ? String(a[2]).localeCompare(b[2]) : a[2] - b[2]) || a[1] - b[1];
// a cell's notes as the roll would show them: [at, len, row]
function cellNotes(c) {
  const out = [];
  if (c.kind === "drum") {
    for (const [k, a] of Object.entries(c.lanes)) if (/^[a-z]$/.test(k)) a.forEach((x, i) => { if (x) out.push([i, 1, k]); });
    return out.sort(cmp3);
  }
  for (let i = 0; i < c.deg.length; i++) {
    if (c.play[i] !== "n") continue;
    let len = 1;
    while (i + len < c.deg.length && c.play[i + len] === "h") len++;
    out.push([i, len, c.deg[i] | 0]);
  }
  return out.sort(cmp3);
}

/* ---------- SAVING AND SHARING ----------
   The song is its genre and seed — genreToDocument is a pure function of the
   two (kernel.js: "the dice are a function, not a stream") — plus what you
   changed: the motifs you wrote, which motif each member reads, the tempo, and
   whose part is yours. Only that is kept, so it fits in the address: every
   change rewrites the link, a reload comes back to it, and copying the link
   shares the song. The last song is also kept in this browser, for a visit
   with no link at all.

   A link is somebody else's data. Everything read from one is checked before
   it touches the document: an unknown genre is refused, a motif that is not
   the shape of a cell is dropped, numbers are clamped, and a member can only
   read a motif that exists. */
let BASE = null;
const STORE = "lilguys.song.v1";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function songState() {
  const st = { g: GENRE, s: SEED };
  if (!DOC || !BASE) return st;
  if (Math.round(DOC.time.bpm) !== Math.round(BASE.time.bpm)) st.t = Math.round(DOC.time.bpm);
  // a cell is kept when it differs from the generated one, or is new and somebody reads it
  const read = new Set();
  for (const v of DOC.voices) for (const sc of DOC.form.sections) { const n = NuDocument.materialAt(v, sc.id); if (n) read.add(n); }
  const c = {};
  for (const [k, cell] of Object.entries(DOC.material.cells)) {
    const b = BASE.material.cells[k];
    if (b ? !same(cell, b) : read.has(k)) c[k] = cell;
  }
  if (Object.keys(c).length) st.c = c;
  const m = {};
  for (const v of DOC.voices) {
    const b = BASE.voices.find((x) => x.name === v.name);
    if (b && !same(v.material ?? null, b.material ?? null)) m[v.name] = v.material ?? null;
  }
  if (Object.keys(m).length) st.m = m;
  if (MINE >= 0) st.p = MINE;
  return st;
}

// a cell from a link, made safe: its shape, or nothing
function cleanCell(c) {
  if (!c || typeof c !== "object") return null;
  if (c.kind === "drum") {
    const lanes = {};
    for (const [k, a] of Object.entries(c.lanes || {})) {
      if (!/^[a-z]$/.test(k) || !Array.isArray(a) || !a.length || a.length > 128) continue;
      lanes[k] = a.map((x) => Math.max(0, Math.min(9, Math.round(+x) || 0)));
    }
    return Object.keys(lanes).length ? { kind: "drum", lanes } : null;
  }
  const L = Array.isArray(c.deg) ? c.deg.length : 0;
  if (!L || L > 256 || !Array.isArray(c.play) || c.play.length !== L) return null;
  const out = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === "kind") out.kind = "line";
    else if (k === "play") out.play = v.map((x) => (x === "n" || x === "h" ? x : "r"));
    else if (k === "deg") out.deg = v.map((d) => Math.max(-28, Math.min(35, Math.round(+d) || 0)));
    else if (Array.isArray(v) && v.length === L && v.every((x) => typeof x === "number" && Number.isFinite(x))) out[k] = v.slice();
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  out.kind = "line";
  return out;
}

// the edits onto a freshly generated, trimmed document; returns whose part is yours (or -1)
function applyEdits(doc, e) {
  if (!e || typeof e !== "object") return -1;
  if (e.t != null && Number.isFinite(+e.t)) doc.time.bpm = Math.max(40, Math.min(220, Math.round(+e.t)));
  if (e.c && typeof e.c === "object")
    for (const [k, c] of Object.entries(e.c)) {
      // (a name is a name: never one that reaches an object's machinery)
      const ok = typeof k === "string" && k.length <= 80 && !/^(__proto__|constructor|prototype)$/.test(k) ? cleanCell(c) : null;
      if (ok) doc.material.cells[k] = ok;
    }
  const known = (n) => typeof n === "string" && !!doc.material.cells[n];
  if (e.m && typeof e.m === "object")
    for (const [name, mat] of Object.entries(e.m)) {
      const v = doc.voices.find((x) => x.name === name);
      if (!v) continue;
      if (mat == null) { if (v.kind === "bass") delete v.material; continue; }
      if (typeof mat === "string") { if (known(mat)) v.material = mat; continue; }
      if (typeof mat === "object") {
        const out = {};
        for (const [sid, n] of Object.entries(mat)) if (known(n) && typeof sid === "string") out[sid] = n;
        if (Object.keys(out).length) v.material = out;
      }
    }
  return Number.isInteger(e.p) && e.p >= 0 && e.p < 4 ? e.p : -1;
}

// the link's own spelling: deflated JSON in base64url (plain base64url JSON where a browser cannot deflate)
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "function") {
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    return "z" + b64u(z);
  }
  return "j" + b64u(raw);
}
async function unpack(str) {
  try {
    const kind = str[0], bytes = unb64u(str.slice(1));
    if (bytes.length > 200000) return null;
    let raw = bytes;
    if (kind === "z") raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else if (kind !== "j") return null;
    return JSON.parse(new TextDecoder().decode(raw));
  } catch (e) { return null; }
}
const editsOf = (st) => { const e = {}; for (const k of ["t", "c", "m", "p"]) if (st[k] != null) e[k] = st[k]; return e; };
async function linkOf(st) {
  const e = editsOf(st);
  return `#g=${encodeURIComponent(st.g)}&s=${st.s}` + (Object.keys(e).length ? "&e=" + (await pack(e)) : "");
}

let persistTimer = 0, persistGen = 0;
function persist(now) {
  clearTimeout(persistTimer);
  const go = async () => {
    const my = ++persistGen;
    const st = songState();
    try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* a private window: the link still holds it */ }
    const link = await linkOf(st);
    if (my === persistGen && !FUZZ) history.replaceState(null, "", link);
  };
  if (now) go(); else persistTimer = setTimeout(go, 250);
}

// what the page opens on: the link if it has one, else the last song in this browser
async function startingSong() {
  const h = new URLSearchParams(location.hash.slice(1));
  const g = h.get("g");
  if (g && ANCHORS.includes(g)) {
    const s = Math.max(1, Math.min(65535, +h.get("s") || 1));
    const e = h.get("e") ? await unpack(h.get("e")) : null;
    return { g, s, e, bad: !!h.get("e") && !e };
  }
  try {
    const st = JSON.parse(localStorage.getItem(STORE));
    if (st && ANCHORS.includes(st.g)) return { g: st.g, s: Math.max(1, Math.min(65535, +st.s || 1)), e: editsOf(st) };
  } catch (e) { /* nothing kept */ }
  return { g: ANCHORS.includes("funk") ? "funk" : ANCHORS[1], s: 1, e: null };
}

async function share() {
  persist(true);
  await new Promise((r) => setTimeout(r, 30));
  const url = location.origin + location.pathname + (await linkOf(songState()));
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    say("link copied: it opens this song, your motifs and all");
  } catch (e) { say("copy this link: " + url); }
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
  persist();
  if (playing) { say(`tempo ${v} — from this bar`); restartHere(); }
}

/* THE COUNT-IN. kernel.js has one, as a section intro: `intro: "count"` is
   four rim clicks and nothing else, the last accented (three in three-four).
   So a count is a one-bar section played by the engine on the engine's own
   clock: a click scheduled beside it would land wherever this device's start
   latency put it.

   IT GOES AT THE END, AND PLAY STARTS ON IT. Put at the front it moved every
   bar of the song one along, and the engine's dice are keyed on where they
   are asked (kernel.js: "a pure hash of WHERE it was asked") — measured, one
   to three drum bars of every song came out different, so you would have been
   practising another song. At the end it moves nothing (measured over six
   genres: every bar's events identical), the walk wraps from it into bar 1 the
   way it always wraps, and when the song comes round you are counted back in.
   Every pitched voice is `out` for it, so nobody leads into a count.

   It is there when you are playing a part yourself (somebody muted) and asked
   to be counted in; put in or taken out only while the band is stopped; and a
   section loop counts nothing. */
const COUNT_ID = "count";
const countSi = () => (DOC ? DOC.form.sections.length - 1 : -1);
const hasCount = () => !!DOC && (DOC.form.sections[DOC.form.sections.length - 1] || {}).id === COUNT_ID;
function syncCount() {
  if (!DOC || playing) return false;
  const want = prefs.countIn && MINE >= 0 && loopOnly == null;
  if (want === hasCount()) return false;
  if (want) {
    DOC.form.sections.push({ id: COUNT_ID, role: "intro", bars: 1, intro: "count", secname: "count-in" });
    for (const v of DOC.voices) if (v.kind !== "drums") (v.development || (v.development = {}))[COUNT_ID] = v.kind === "bass" ? "nobass" : "out";
  } else {
    DOC.form.sections.pop();
    for (const v of DOC.voices) if (v.development) delete v.development[COUNT_ID];
  }
  return true;
}
// where the count is, on the engine's clock: its first beat, and how many it has
function countSpan() {
  if (!hasCount()) return null;
  const TL = plan.timeline(), cs = countSi();
  const bar = TL.find((b) => b.si === cs);
  return bar && bar.beat0 != null ? { beat0: bar.beat0, beats: bar.barSteps / 4 } : null;
}

/* NOW, NOT A RUNWAY LATER. The engine renders seconds ahead of the ear, so a
   tempo or a mute fed through it is heard seconds late — long enough that a
   reader who slowed down is still sight-reading at the old speed. A change to
   either, while playing, starts the band again from the bar that is sounding
   (live.js startAt's `bar`): a gap of a fraction of a second, then the new
   tempo or the new mute. Debounced, so three taps on "faster" are one restart.
   Motif edits keep the runway: a restart per tapped note would be a stutter. */
let restartTimer = 0;
function restartHere() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (!playing || !SCORE) return;
    const now = beatNow();
    const bi = now >= 0 ? sectionAtBeat(now) : -1;
    if (bi < 0) return;
    stop();
    startAt(SCORE.bars[bi].si, bi);
  }, 350);
}

async function loadGenre(gk, seed, edits = null) {
  const was = playing;
  if (was) stop();
  GENRE = gk; SEED = seed;
  DOC = NuPrecompose.genreToDocument(gk, seed);
  members = trimBand(DOC);
  BASE = JSON.parse(JSON.stringify(DOC));        // what the edits are measured against
  GENRE_BPM = DOC.time.bpm;
  const mine = edits ? applyEdits(DOC, edits) : -1;
  MINE = -1;
  setLoopOnly(null); $("loopSec").checked = false;
  setTempo(DOC.time.bpm, true);
  push(true);
  if (mine >= 0 && members[mine]) setMine(mine, true, true);
  $("genre").value = titleOf(gk);
  document.title = `${titleOf(gk)} — Stellate Lilguys`;
  buildBand();
  select(-1);
  if (READ) { PART = firstPart(PART); applyReadPart(); }
  lastSec = -2;
  say(`${titleOf(gk)}: ${members.filter(Boolean).length} play. Click one to open its motifs.`);
  warmup();
  persist(true);
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
  const first = await startingSong();
  await loadGenre(first.g, first.s, first.e);
  if (first.bad) say("that link's edits could not be read; here is the song without them");
  $("play").disabled = false;
  $("play").addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (syncCount()) push(false);
    say(hasCount() ? "counting you in…" : "starting the band… (the engine fills its buffer first)");
    startAt(loopOnly != null ? loopOnly : hasCount() ? countSi() : 0);
  });
  wireRead();
  on("transport:state", ({ playing: p }) => {
    if (p && judge) { judgedTo = -1; }
    if (READ) { paintRail(); holdScreen(true); }
    $("play").textContent = p ? "stop" : "play";
    $("play").setAttribute("aria-pressed", String(!!p));
    if (!p) { staffRest = -0.001; lastSec = -2; if (syncCount()) push(false); }
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
  $("share").addEventListener("click", share);
  $("listen").addEventListener("click", toggleListen);
  $("oListen").addEventListener("click", toggleListen);
  if (!Listener.supported) [$("listen"), $("oListen")].forEach((b) => { b.title = "no MIDI in this browser: Chrome or Edge on a computer can listen"; });
  $("rShare").addEventListener("click", share);
  $("closeDrawer").addEventListener("click", () => select(-1));
  $("mine").addEventListener("change", (e) => { if (SEL >= 0) setMine(SEL, e.target.checked); });
  $("loopSec").addEventListener("change", (e) => {
    const now = playing ? beatNow() : -1;
    const bi = now >= 0 ? sectionAtBeat(now) : -1;
    const si = bi >= 0 ? SCORE.bars[bi].si : 0;
    setLoopOnly(e.target.checked ? si : null);
    syncCount();
    push(false);
    say(e.target.checked ? `looping ${roleWord(si)}` : "the whole song again");
    if (playing) { stop(); startAt(e.target.checked ? si : si); }
  });
  // the keyboard: space plays, 1-4 open a member
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, select, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); $("play").click(); }
    else if (/^Digit[1-4]$/.test(e.code)) { if (READ) { PART = firstPart(+e.code.slice(5) - 1); applyReadPart(); } else select(+e.code.slice(5) - 1); }
    else if (e.code === "Escape") { if (READ) exitRead(); else select(-1); }
    else if (e.code === "KeyR") READ ? exitRead() : enterRead();
  });
  requestAnimationFrame(frame);
  // #fuzz: the fuzzer, run in this page (on a phone, where no harness reaches)
  if (FUZZ) import("./fuzz.js").then((F) => F.runInPage(window.__lil, {
    walks: +FUZZ.get("walks") || 6, ops: +FUZZ.get("ops") || 60, seed: +FUZZ.get("seed") || 1 }));
}

// THE PAGE'S OWN HANDLE, for the gates and the fuzzer (lilguys/fuzz.js): what
// it holds, the invariants, and the few doors a hand cannot reach by clicking.
window.__lil = {
  get DOC() { return DOC; }, get SCORE() { return SCORE; }, get GENRE() { return GENRE; },
  get SEL() { return SEL; }, get MINE() { return MINE; }, get READ() { return READ; }, get PART() { return PART; },
  get CELL() { return CELL; }, get playing() { return playing; }, get bpm() { return bpm; },
  get loop() { return loopOnly; }, get anchors() { return ANCHORS; },
  members: () => members, plan, roll: () => roll, staff: () => staff, cellNotes, cellsOf,
  check, push, resetPrefs, hear, get judge() { return judge; },
  listenForTest: () => { LISTEN = true; makeJudge(); }, songState, applyEdits, pack, unpack, linkOf, trimBand, loadGenre, select, setMine, setTempo, enterRead, exitRead, songBeatNow, beatNow, getPosition, prefs,
};
boot().catch((e) => { console.error(e); say("could not start: " + (e && e.message || e)); });
