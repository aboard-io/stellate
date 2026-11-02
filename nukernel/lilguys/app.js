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
import { startAt, stop, playing, warmup, songBeatNow, getPosition, engineHandle, health } from "../audio/live.js";
import * as plan from "../audio/plan.js";
import { scoreOf } from "../export/score.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";
import { drawSprite, quaver, zee, COL, BG, INK, MID, LOOK, BASS, mix } from "./sprites.js";
import { Roll } from "./roll.js";
import { Judge, Listener } from "./listen.js";
import { Staff } from "./staff.js";
import { chordName } from "../ui/paper.js";
import { icon, wordIcon, edgeIcon } from "./icons.js";

const $ = (id) => document.getElementById(id);
// asked before the first genre rewrites the address
const FUZZ = /(^|[#&])fuzz\b/.test(location.hash) ? new URLSearchParams(location.hash.slice(1)) : null;
const GK = "lab.lilguys.";
// SAFARI'S OUTPUT, ON TRIAL (Paul, 2026-11-02: "the audio is getting staticky
// after a few minutes", Safari on headphones). Safari plays the engine through
// a hidden <audio> element (live.js canMediaEl), whose clock drifts from the
// AudioContext's; the engine carries two cures, both opt-in. The page's address
// picks one: ?out=classic (straight to the speakers, no element) or
// ?out=recycle (a fresh element every 45 s). Absent: what the engine does.
{
  const out = new URLSearchParams(location.search).get("out");
  if (out === "classic") window.__nuOutOpts = { forceClassicOut: true };
  else if (out === "recycle") window.__nuOutOpts = { elRecycleSec: 45 };
}
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

/* TWO PHRASES A MEMBER, AT MOST (Paul, 2026-11-02: "every voice gets a simple
   phrase. Other phrases are derived from that phrase. At most they might have
   two"). The composer hands a member up to five separate cells (funk's keys
   read counter, pad, hook, answer and climb), and nothing ties one to another,
   so there was no way to edit "the" part. Here each member keeps its MAIN
   phrase — what it plays in the first verse — and, when the first chorus (a
   dance form's drop) read something else, that one as its CHORUS phrase. Every
   other section reads one of the two; the section's development word (busy,
   walk, backwards, octaves …) is what makes it a variation. Done before BASE
   is taken, and a pure function of the document, so a link still replays. The
   cells nobody reads any more stay in the bank: an older link may name them. */
function twoPhrases(doc) {
  const secs = doc.form.sections;
  const HOOKY = ["chorus", "drop"];   // the section a song is built to arrive at
  for (const v of doc.voices) {
    if (v.material == null || typeof v.material === "string") continue;
    const plays = (sc) => (v.development || {})[sc.id] !== "out";
    const at = (sc) => { const n = sc && NuDocument.materialAt(v, sc.id); return n && doc.material.cells[n] ? n : null; };
    // what the first section of a role plays, where this member plays in one
    const first = (roles) => at(secs.find((sc) => roles.includes(sc.role) && plays(sc)));
    // the main phrase is the verse's; a form with no verse falls back to the
    // phrase read in the most sections (counting can crown a 4-note "sparse"
    // fill, which is why the verse comes first)
    let main = first(["verse"]);
    if (!main) {
      const n = new Map();
      for (const sc of secs) { const c = plays(sc) && at(sc); if (c) n.set(c, (n.get(c) || 0) + 1); }
      main = [...n.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || at({ id: "" });
    }
    if (!main) continue;
    const hook = first(HOOKY);
    if (!hook || hook === main) { v.material = main; continue; }
    const mat = { "": main };
    for (const sc of secs) if (HOOKY.includes(sc.role)) mat[sc.id] = hook;
    v.material = mat;
  }
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
  const dparts = NuDeskDoc.deskPartsOf(engineDoc(), GENRES);
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

/* ---------- MUTE AND SOLO, NOW (Paul, 2026-11-02: "those should be instant") ----------
   The document keeps what the hand set (voice.desk mute / solo, saved in the
   link), but the engine is told something narrower. A member whose sound is
   all SAMPLED units it does not share is cut at the engine's unit gate
   (engine/faust/live/live.js gateUnit), on main-thread nodes, in ~5 ms both
   ways, and its notes stay in the score so unmuting is just as quick. Only a
   member the gate cannot reach (a Faust-modelled voice, rendered in the
   worker; a seat two members share) is muted in the score, which the engine
   hears a runway late. Solo is resolved HERE into those cuts, across exactly
   the four members — the desk's own solo rule kept the bass sounding under
   any solo (the measured leak). */
let UNITS_OF = new Map();      // unit key -> Set(member)
let GATEABLE = new Set();      // members the gate can cut alone
function engineDoc() {
  const voices = DOC.voices.map((v) => {
    const m = members.indexOf(v);
    const d = { ...(v.desk || {}) };
    delete d.solo;
    if (m >= 0 && cutOf(m) && !GATEABLE.has(m)) d.mute = true; else delete d.mute;
    if (m >= 0 && GATEABLE.has(m)) delete d.fader;     // the gate carries it, now
    const o = { ...v };
    if (Object.keys(d).length) o.desk = d; else delete o.desk;
    return o;
  });
  return { ...DOC, voices };
}
function mapUnits() {
  const units = new Map(), sampled = new Map();
  try {
    const TL = plan.timeline(), seen = new Set(), used = new Set();
    const chanVoice = new Map(NuDeskDoc.channelVoicesOf(DOC, GENRES).map((c) => [c.key, c.voice]));
    // a unit that never plays a note (a kit's synth `perc` and `stab` lanes, mostly)
    // does not stand between its member and the gate
    for (let n = 0; n < TL.length; n++) {
      const bp = plan.barPlan(n); if (!bp || !bp.ev) continue;
      for (const e of bp.ev.pitched) used.add(e.voice);
      for (const e of bp.ev.drums) used.add(e.drum);
    }
    for (let n = 0; n < TL.length; n++) {
      if (seen.has(TL[n].si)) continue;
      seen.add(TL[n].si);
      const bp = plan.barPlan(n); if (!bp || !bp.units) continue;
      const A = plan.addrOf(TL[n].si) || {};
      for (const [key, u] of Object.entries(bp.units)) {
        if (!u || key.slice(0, 2) === "__" || !used.has(key)) continue;
        const drum = !!u.drum || !!(u.__meta && u.__meta.drum);
        const chan = A[key] || (drum ? "drums" : "");
        const m = chan === "drums" ? 0 : members.indexOf(chanVoice.get(chan));
        if (m < 0) continue;
        if (!units.has(key)) units.set(key, new Set());
        units.get(key).add(m);
        sampled.set(key, (sampled.get(key) ?? true) && !!u.sampler);
      }
    }
  } catch (e) { /* no plan yet: nothing is gateable, everything goes the score's way */ }
  const gate = new Set();
  for (let m = 0; m < 4; m++) {
    const mine = [...units.entries()].filter(([, ms]) => ms.has(m));
    if (mine.length && mine.every(([k, ms]) => ms.size === 1 && sampled.get(k))) gate.add(m);
  }
  const changed = [...gate].sort().join() !== [...GATEABLE].sort().join();
  UNITS_OF = units; GATEABLE = gate;
  return changed;
}
// unit key -> its gain (0 = shut), for every unit: a gateable member's units
// carry its cut and its fader; every other unit stays at 1
function wantGates() {
  const out = {};
  for (const [key, ms] of UNITS_OF) {
    const m = ms.size === 1 ? [...ms][0] : -1;
    const own = m >= 0 && GATEABLE.has(m);
    out[key] = !own ? 1 : cutOf(m) ? 0 : +Math.pow(10, (deskOf(m).fader || 0) / 20).toFixed(4);
  }
  return out;
}
function applyGates() {
  const h = engineHandle();
  if (!h || !h.gateUnit) return;
  for (const [key, open] of Object.entries(wantGates())) h.gateUnit(key, open);
}

/* ---------- the score, as played: who plays what, on which beat ---------- */
let SCORE = null;            // { boxes, parts: [notes[] per member], bars: [...] }
let regating = false;
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
    // ...AND WHO PLAYED EACH NOTE, WHERE TWO SHARE A SEAT. plan.js castOf keys
    // a seat by its sound (chair|instr|synth|tone|vox), so two members on the
    // same instrument — acid's two 303 lines — are one seat and one lane, and
    // the lane gave every note to one of them: the keys' clips and staff came
    // up empty while the keys were playing. The timeline still knows each
    // line event's voice (`lv`, else `v`, the index into the document's lines),
    // so a note is looked up there by its beat and pitch class first.
    const lineVoices = DOC.voices.filter((v) => v.kind === "line");
    const whoAt = new Map();
    for (const tb of TL) {
      if (tb.si === cs || !tb.ev) continue;
      for (const e of tb.ev) {
        if (e.kind !== "line" || e.n == null || e.layer) continue;
        const vi = e.lv == null ? e.v : e.lv, m = members.indexOf(lineVoices[vi]);
        if (m < 0) continue;
        const k = (tb.beat0 + e.off / 4).toFixed(3) + "|" + ((((e.n + (e.home || 0)) % 12) + 12) % 12);
        const was = whoAt.get(k);
        whoAt.set(k, was == null || was === m ? m : -2);     // -2: both play it; the lane decides
      }
    }
    for (const box of sc.boxes) {
      if (box.si === cs) continue;
      const A = plan.addrOf(box.si) || {};
      // a seat is SHARED here only when the section has fewer line lanes than
      // line members playing in it; anywhere else the lane's own chair is the
      // truth (a voice's index counts only the lines that play, so a lookup in
      // a section someone sits out hands one member's notes to the other)
      const sid = DOC.form.sections[box.si] && DOC.form.sections[box.si].id;
      const linePlaying = [2, 3].filter((m) => members[m] && !isOut((members[m].development || {})[sid] || "")).length;
      const lineLanes = box.lanes.filter((l) => l.name !== "drums" && A[l.name] !== "drums" && l.chair !== "bass").length;
      const shared = lineLanes < linePlaying;
      for (const lane of box.lanes) {
        let m = -1;
        if (lane.name === "drums" || A[lane.name] === "drums") m = 0;
        else {
          const v = chanVoice.get(A[lane.name]);
          m = v ? members.indexOf(v) : -1;
          if (m < 0) m = lane.chair === "bass" ? 1 : -1;
        }
        if (m < 0) continue;                 // a layer with no chair of its own
        for (const n of lane.notes) {
          const beat = n.beat + box.beat0;
          const w = shared && m >= 2 ? whoAt.get(beat.toFixed(3) + "|" + (((n.midi % 12) + 12) % 12)) : null;
          parts[w != null && w >= 0 ? w : m].push({ ...n, beat });
        }
      }
    }
    parts.forEach((p) => p.sort((a, b) => a.beat - b.beat));
    // the bars: each timeline bar's downbeat, its section's name on the first
    const bars = TL.filter((b) => b.si !== cs).map((b, i) => ({ n: i + 1, beat: b.beat0, beats: b.barSteps / 4,
      si: b.si, label: b.first ? roleWord(b.si) : "" }));
    chordsOnto(bars);
    SCORE = { boxes: sc.boxes, parts, bars };
    paintStaffData();
    drawLanes();
    const regate = mapUnits();
    if (regate && members.some((v, m) => v && cutOf(m)) && !regating) { regating = true; try { push(false); } finally { regating = false; } }
    applyGates();
    if (regate && cards.length) refreshCards();
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
    const all = NuDocument.chordsIn(DOC, GENRES).chords.filter((c) => c.deg != null).sort((x, y) => x.from - y.from);
    // each section's chords from its first, a bar at a time, by when they
    // sound (chordsIn's `bar` counts phrase bars — see secChordObjs)
    const t0 = new Map();
    for (const c of all) if (!t0.has(c.sec)) t0.set(c.sec, c.from);
    const spb = Math.round(stepsPerBar()) || 16;
    const at = (si, step) => all.find((c) => c.sec === si && c.from <= step + 1e-6 && step + 1e-6 < c.to);
    let last = "";
    const seen = new Map();             // section -> bars of it met so far (the timeline may loop one)
    for (const b of bars) {
      const k = seen.get(b.si) || 0; seen.set(b.si, k + 1);
      if (!t0.has(b.si)) { b.chord = ""; b.chord2 = ""; continue; }
      const s0 = t0.get(b.si) + k * spb;
      const c1 = at(b.si, s0), c2 = at(b.si, s0 + spb / 2);
      const one = chordSymbol(c1), two = c2 && c2 !== c1 ? chordSymbol(c2) : "";
      b.chord = one && one !== last ? one : "";
      b.chord2 = two && two !== (one || last) ? two : "";
      last = two || one || last;
    }
  } catch (e) { /* no chords is a staff without symbols, not an error */ }
}
// A SECTION'S CHORDS, bar by bar: [[deg, ...chords in the bar], ...] (document.js chordsIn)
// (each chord says its own section, `sec`, and its bar in the song: a section's
// bars are counted from its first, not from section lengths — those are in
// phrases, not bars)
let chordMemo = { score: null, by: new Map() };
function secChords(si) {
  if (chordMemo.score !== SCORE) chordMemo = { score: SCORE, by: new Map() };
  if (!chordMemo.by.has(si)) chordMemo.by.set(si, secChordsNow(si));
  return chordMemo.by.get(si);
}
function secChordsNow(si) { return secChordObjs(si).map((c) => [c.d]); }
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
    // A MEMBER IS A BUTTON WITH ITS LILGUY IN IT (2026-11-02, Paul: "I have the
    // four buttons (drums, bass, etc) and the lilguys are IN the buttons. I
    // click a button and the edit view appears"). Under it its mute, its solo,
    // and an eye: whether its notes show through the phrase you are editing.
    const card = document.createElement("div");
    card.className = "mcard";
    card.style.setProperty("--mc", COL[m]);
    card.innerHTML = `<button class="member" aria-pressed="false"><canvas width="60" height="64"></canvas><span class="who"></span></button>
      <div class="mctl"><button class="tm icon" aria-pressed="false" aria-label="mute">${icon("volume-x")}</button>
        <button class="ts icon" aria-pressed="false" aria-label="solo">${icon("headphones")}</button>
        <button class="te icon" aria-pressed="true" aria-label="show its notes while editing another">${icon("eye")}</button></div>`;
    const b = card.querySelector(".member");
    b.addEventListener("click", () => {
      if (READ) { if (members[m]) { PART = m; applyReadPart(); } return; }   // reading: whose part
      select(SEL === m ? -1 : m);
    });
    const c = { el: b, cv: b.querySelector("canvas"), blink: performance.now() + 1500 + m * 700, track: card,
      mb: card.querySelector(".tm"), sb: card.querySelector(".ts"), eb: card.querySelector(".te") };
    c.mb.addEventListener("click", () => {
      if (MINE === m) { setMine(m, false); return; }
      setDesk(m, "mute", !deskOf(m).mute);
    });
    c.sb.addEventListener("click", () => setDesk(m, "solo", !deskOf(m).solo));
    c.eb.addEventListener("click", () => { SHOWN[m] = !SHOWN[m]; shadeKey = ""; refreshCards(); });
    host.appendChild(card);
    cards.push(c);
  }
  refreshCards();
}
const SHOWN = [true, true, true, true];     // whose notes show through the phrase open
function refreshCards() {
  cards.forEach((c, m) => {
    const v = members[m];
    c.el.querySelector(".who").textContent = whoOf(m);
    c.el.setAttribute("aria-pressed", String(SEL === m));
    c.el.classList.toggle("yours", MINE === m);
    c.el.classList.toggle("out", !v);
    c.el.title = v ? pretty(instrumentOf(m)) : "";
    c.el.setAttribute("aria-label", `${whoOf(m)}${v ? ", " + pretty(instrumentOf(m)) : ""}`);
    const d = deskOf(m);
    c.track.classList.toggle("absent", !v);
    c.track.classList.toggle("sel", SEL === m);
    c.track.classList.toggle("cut", !!v && cutOf(m));
    for (const el of [c.mb, c.sb, c.eb]) el.disabled = !v;
    // a synth voice (or a seat two members share) cannot be gated: its M and S land a runway late
    const late = !!v && !GATEABLE.has(m);
    c.track.classList.toggle("late", late);
    c.mb.setAttribute("aria-pressed", String(!!d.mute));
    c.sb.setAttribute("aria-pressed", String(!!d.solo));
    c.eb.setAttribute("aria-pressed", String(SHOWN[m]));
    c.eb.innerHTML = icon(SHOWN[m] ? "eye" : "eye-off");
    c.eb.hidden = SEL < 0 || SEL === m;
  });
  document.body.classList.toggle("editing", SEL >= 0);
  if (SEL >= 0 && members[SEL]) {
    const d = deskOf(SEL);
    if (document.activeElement !== $("vol")) $("vol").value = d.fader || 0;
    $("vol").title = `${d.fader > 0 ? "+" : ""}${d.fader || 0} dB`;
  }
  drawLanes();
}

/* ---------- the desk: volume, mute, solo — the part strip's own fields ----------
   fields.js PARTMIX `fader` (dB, -24..+12), `mute`, `solo`, on the voice
   (`voice.desk`), which is what audio/desk.js partsOf reads: a mute or a solo
   elsewhere is a gain of 0. NOTHING HERE STOPS THE BAND. The change is pushed
   like a motif edit and the engine picks it up at the next bar it has not
   rendered yet — a few seconds, its runway — instead of the stop-and-restart
   that used to cut the whole mix. */
const deskOf = (m) => (members[m] && members[m].desk) || {};
function cutOf(m) {
  const d = deskOf(m);
  if (d.mute) return true;
  return members.some((v) => v && v.desk && v.desk.solo) && !d.solo;
}
function setDesk(m, key, val) {
  const v = members[m];
  if (!v) return;
  const d = { ...(v.desk || {}) };
  if (key === "fader") { const x = Math.round(Math.max(-24, Math.min(12, +val || 0))); if (x) d.fader = x; else delete d.fader; }
  else if (val) d[key] = true; else delete d[key];
  if (Object.keys(d).length) v.desk = d; else delete v.desk;
  push(false);
  persist();
  refreshCards();
  const who = whoOf(m).toLowerCase();
  const what = key === "fader" ? `at ${d.fader > 0 ? "+" : ""}${d.fader || 0} dB` : key === "mute" ? (val ? "muted" : "unmuted") : (val ? "soloed" : "not soloed");
  const late = playing && members.some((x, k) => x && !GATEABLE.has(k) && (k === m || key === "solo"));
  say(`${who} ${what}${late ? " — some of it lands in a few seconds (a synth voice renders ahead)" : ""}`);
}

/* ---------- the arrangement: a ruler, and a clip a section in every lane ---------- */
// each section's span in beats, from the score's own bars (the count-in is not in them)
function spans() {
  const out = [];
  if (!SCORE || !SCORE.bars.length) return out;
  for (const b of SCORE.bars) {
    const o = out[out.length - 1];
    if (o && o.si === b.si && Math.abs(o.b1 - b.beat) < 1e-6) o.b1 = b.beat + b.beats;
    else out.push({ si: b.si, b0: b.beat, b1: b.beat + b.beats });
  }
  return out;
}
const songEnd = () => { const S = spans(); return S.length ? S[S.length - 1].b1 : 0; };
function secAtX(el, e) {
  const r = el.getBoundingClientRect(), end = songEnd();
  if (!end) return -1;
  const beat = (e.clientX - r.left) / r.width * end;
  const sp = spans().find((x) => beat >= x.b0 && beat < x.b1);
  return sp ? sp.si : -1;
}
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const cx = cv.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cx, w: r.width, h: r.height };
}
const HOOKY = ["chorus", "drop"];
// which of the member's (at most two) phrases a section reads, in a word
function phraseWord(m, si) {
  const v = members[m];
  const name = v && NuDocument.materialAt(v, secId(si));
  if (!name || !DOC.material.cells[name]) return m === 1 ? "follows the chords" : "";
  const many = cellsOf(m).length > 1;
  return many && HOOKY.includes(DOC.form.sections[si].role) && name !== NuDocument.materialAt(v, "") ? "chorus" : "main";
}
/* ---------- THE SONG, ALONG THE BOTTOM (2026-11-02, Paul: "Along the bottom is
   the song structure. Everything is editable and movable. Chord progressions
   can be tweaked. THEN each individual invocation can pick a phrase and up to
   five transformations … songs are made of small phrases getting switched in
   and out.") ----------
   A block a section, as wide as its bars: its name (tap: play from here; drag
   the grip: move it), its chords as roman numerals (tap one to change it),
   then a row a member — the phrase it reads there (a letter: tap to switch),
   what it plays there in miniature (tap: open it), and its transformations as
   icons (tap one off; + for another, five at most). No words. */
let FOCUS = -1;                 // the section the editor is looking at
const SRC = new Map();          // a copied section's id -> the generated section it copies (for the link)
const srcOf = (id) => SRC.get(id) || id;
const MAXW = 5;                 // transformations an invocation may stack
function secBars(si) {
  const n = SCORE ? SCORE.bars.filter((b) => b.si === si).length : 0;
  return n || (DOC.form.sections[si] || {}).bars || 1;
}
function drawLanes() {
  const host = $("secs");
  if (!host || !DOC || READ) return;
  const keep = host.scrollLeft;
  host.replaceChildren();
  const secs = DOC.form.sections, S = spans();
  secs.forEach((sc, si) => {
    if (sc.id === COUNT_ID) return;
    const bars = secBars(si);
    const el = document.createElement("div");
    el.className = "sec" + (si === FOCUS && SEL >= 0 ? " focus" : "");
    el.dataset.si = si;
    el.style.flexGrow = bars;
    el.style.minWidth = Math.max(104, bars * 30) + "px";
    // the chords: a numeral a bar, a repeat dimmed
    const ch = secChordObjs(si);
    const chords = ch.map((c, k) => `<button class="ch${k && ch[k - 1] && c && ch[k - 1].d === c.d && ch[k - 1].q === c.q ? " same" : ""}" data-k="${k}" title="bar ${k + 1}">${c ? roman(c.d, c.q) : "·"}</button>`).join("");
    let rows = "";
    for (let m = 0; m < 4; m++) {
      const v = members[m];
      if (!v) { rows += `<div class="inv none" data-m="${m}"></div>`; continue; }
      const dev = (v.development || {})[sc.id];
      const out = isOut(dev);
      const name = NuDocument.materialAt(v, sc.id);
      const L = name && DOC.material.cells[name] ? letterOf(m, name) : "~";
      const ws = devChain(m, sc.id).filter((x) => !OUT.test(x));
      const eg = (f) => (m === 0 && sc[f] ? `<button class="tw on edge" data-e="${f}" data-v="${sc[f]}" title="${edgeLabel(f, sc[f])}">${icon(edgeIcon(sc[f]))}<b>${f === "intro" ? "›" : "‹"}</b></button>` : "");
      const tws = out ? "" : eg("intro") + ws.map((w) => { const ic = wordIcon(kindOf(m), w); return `<button class="tw on" data-w="${w.replace(/"/g, "&quot;")}" title="${w}">${icon(ic.name)}${ic.badge ? `<b>${ic.badge}</b>` : ""}</button>`; }).join("") + eg("outro")
        + (ws.length < MAXW ? `<button class="tw add" title="add">${icon("plus")}</button>` : "");
      rows += `<div class="inv${SEL === m ? " sel" : ""}${out ? " out" : ""}${cutOf(m) ? " cut" : ""}" data-m="${m}" style="--mc:${COL[m]}">`
        + `<button class="pl" title="phrase">${out ? icon("volume-x") : L}</button>`
        + `<canvas class="pv"></canvas><div class="tws">${tws}</div></div>`;
    }
    el.innerHTML = `<div class="shead" draggable="true"><span class="grip">${icon("grip-vertical")}</span>`
      + `<button class="sname">${roleWord(si)}</button><span class="sact">`
      + `<button class="icon" data-a="less" title="a bar less">${icon("minus")}</button><button class="icon" data-a="more" title="a bar more">${icon("plus")}</button>`
      + `<button class="icon" data-a="dup" title="copy">${icon("copy")}</button><button class="icon" data-a="del" title="remove">${icon("trash-2")}</button></span></div>`
      + `<div class="schords">${chords}</div>${rows}<div class="sbar"></div>`;
    wireSec(el, si);
    host.appendChild(el);
    // each preview: what that member plays in this section, from the score
    const sp = S.find((x) => x.si === si);
    el.querySelectorAll(".inv[data-m]").forEach((row) => {
      const m = +row.dataset.m, cv = row.querySelector(".pv");
      if (cv && sp) drawPreview(cv, m, sp.b0, sp.b1);
    });
  });
  const add = document.createElement("button");
  add.className = "icon addsec"; add.title = "another section"; add.innerHTML = icon("plus");
  add.addEventListener("click", () => { const last = secs.map((x, i) => i).filter((i) => secs[i].id !== COUNT_ID).pop(); if (last != null) dupSection(last); });
  host.appendChild(add);
  host.scrollLeft = keep;
  litAt = -2;
}
function drawPreview(cv, m, b0, b1) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.round(r.width || 60)), h = Math.max(8, Math.round(r.height || 18));
  cv.width = w * dpr; cv.height = h * dpr;
  const cx = cv.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const notes = (SCORE && SCORE.parts[m] || []).filter((n) => n.beat >= b0 && n.beat < b1);
  if (!notes.length) return;
  let lo = 127, hi = 0;
  for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  const rng = Math.max(5, hi - lo), mid = (lo + hi) / 2, nh = Math.max(1.5, Math.min(3, h / (rng + 1)));
  cx.fillStyle = COL[m];
  cx.globalAlpha = cutOf(m) ? 0.35 : 0.95;
  for (const n of notes) {
    const x = (n.beat - b0) / (b1 - b0) * w, nw = Math.max(1.2, n.dur / (b1 - b0) * w - 0.4);
    const y = h / 2 - (n.midi - mid) / rng * (h - nh - 2);
    cx.fillRect(x, y - nh / 2, nw, nh);
  }
}
function wireSec(el, si) {
  const sc = DOC.form.sections[si];
  el.querySelector(".sname").addEventListener("click", () => {
    FOCUS = si; shadeKey = "";
    if (loopOnly != null) { setLoopOnly(si); push(false); }
    startAt(si);
    drawLanes();
  });
  el.querySelectorAll(".sact [data-a]").forEach((b) => b.addEventListener("click", () => {
    const a = b.dataset.a;
    if (a === "dup") dupSection(si);
    else if (a === "del") delSection(si);
    else setBars(si, secBars(si) + (a === "more" ? 1 : -1));
  }));
  el.querySelectorAll(".ch").forEach((b) => b.addEventListener("click", () => openChordMenu(si, +b.dataset.k, b)));
  el.querySelectorAll(".inv[data-m]").forEach((row) => {
    const m = +row.dataset.m;
    if (!members[m]) return;
    row.querySelector(".pl").addEventListener("click", (e) => openPhraseMenu(m, si, e.currentTarget));
    row.querySelector(".pv").addEventListener("click", () => select(m, si));
    row.querySelectorAll(".tw[data-w]").forEach((b) => b.addEventListener("click", () => {
      setDev(m, sc.id, devChain(m, sc.id).filter((x) => x !== b.dataset.w));
    }));
    row.querySelectorAll(".tw.edge").forEach((b) => b.addEventListener("click", () => setEdge(sc, b.dataset.e, null)));
    const add = row.querySelector(".tw.add");
    if (add) add.addEventListener("click", (e) => openWordMenu(m, sc.id, e.currentTarget));
  });
  // MOVED BY ITS GRIP: dragged onto another block, it goes before it
  const head = el.querySelector(".shead");
  head.addEventListener("dragstart", (e) => { dragSec = si; el.classList.add("dragging"); try { e.dataTransfer.setData("text/plain", String(si)); e.dataTransfer.effectAllowed = "move"; } catch (err) {} });
  head.addEventListener("dragend", () => { dragSec = -1; el.classList.remove("dragging"); document.querySelectorAll(".sec.over").forEach((x) => x.classList.remove("over", "after")); });
  el.addEventListener("dragover", (e) => {
    if (dragSec < 0 || dragSec === si) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
    el.classList.add("over"); el.classList.toggle("after", after);
  });
  el.addEventListener("dragleave", () => el.classList.remove("over", "after"));
  el.addEventListener("drop", (e) => {
    if (dragSec < 0 || dragSec === si) return;
    e.preventDefault();
    const after = el.classList.contains("after");
    el.classList.remove("over", "after");
    moveSection(dragSec, after ? si + 1 : si);
  });
}
let dragSec = -1;

/* ---------- ROMAN NUMERALS (Paul, 2026-11-02: "use roman numeral notation for
   chord changes"): the degree in the key's own mode — upper case where the
   mode makes it major, lower where minor, ° diminished, + augmented — and the
   chord's own seventh after it. ---------- */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function roman(d, q) {
  const st = modeSteps(), n = st.length, i = ((d % n) + n) % n;
  const third = ((st[(i + 2) % n] - st[i]) % 12 + 12) % 12, fifth = ((st[(i + 4) % n] - st[i]) % 12 + 12) % 12;
  let r = ROMAN[i] || String(i + 1);
  if (q === "dom7") return r + "7";
  if (third === 3) r = r.toLowerCase();
  if (fifth === 6) r += "°"; else if (fifth === 8) r += "+";
  if (q === "7" || q === "maj7" || q === "m7") r += "7";
  else if (q && q !== "triad") r += "<sup>" + String(q).replace(/[^\w#b]/g, "").slice(0, 4) + "</sup>";
  return r;
}
// THE SECTION'S CHORDS, A BAR EACH, as they SOUND: { d, q } for each of the
// section's real bars. document.js chordsIn times each chord in steps (from,
// to), and that timing is the truth — its `bar` counts the document's phrase
// bars (a two-bar cell makes a "bar" two bars long), so a chart read by `bar`
// put a chord on every bar where the band changes every other one. A section
// is read from its first chord on, a bar at a time.
function secChordObjs(si) {
  if (chordMemo.score !== SCORE) chordMemo = { score: SCORE, by: new Map() };
  const k = "o" + si;
  if (!chordMemo.by.has(k)) chordMemo.by.set(k, secChordObjsNow(si));
  return chordMemo.by.get(k);
}
function secChordObjsNow(si) {
  let all = [];
  try { all = NuDocument.chordsIn(DOC, GENRES).chords.filter((c) => c.sec === si && c.deg != null); } catch (e) { return []; }
  if (!all.length) return [];
  all.sort((x, y) => x.from - y.from);
  const t0 = all[0].from, spb = Math.round(stepsPerBar()) || 16, n = secBars(si), out = [];
  for (let j = 0; j < n; j++) {
    const at = t0 + j * spb + 1e-6;
    const c = all.find((x) => x.from <= at && at < x.to) || all.filter((x) => x.from <= at).pop() || all[0];
    out.push({ d: c.deg | 0, q: c.q || null });
  }
  return out;
}
// a chart a bar written as the document holds one: an entry per phrase bar
// (barsOf: a two-bar cell, two bars), split evenly into its bars' chords where
// they differ (kernel.js: "unstated chords split the bar evenly")
function writeChart(sc, perBar) {
  const per = Math.max(1, (NuDocument.barsOf ? NuDocument.barsOf(DOC) : 1) | 0);
  const obj = (c) => ({ d: c.d, ...(c.q ? { q: c.q } : {}) });
  const prog = [];
  for (let u = 0; u * per < perBar.length; u++) {
    const part = [];
    for (let i = 0; i < per; i++) part.push(perBar[Math.min(perBar.length - 1, u * per + i)]);
    prog.push(part.every((c) => c.d === part[0].d && (c.q || null) === (part[0].q || null)) ? obj(part[0]) : part.map(obj));
  }
  sc.prog = prog;
}
function openChordMenu(si, k, anchor) {
  const menu = $("wordMenu"), cur = secChordObjs(si)[k] || { d: 0 };
  const n = modeSteps().length;
  menu.className = "wordmenu chords";
  menu.innerHTML = Array.from({ length: n }, (_, d) => `<button role="menuitem" data-d="${d}" class="${cur.d === d ? "on" : ""}">${roman(d, cur.d === d ? cur.q : null)}</button>`).join("")
    + `<button role="menuitem" data-q="7" class="${cur.q === "7" || cur.q === "dom7" ? "on" : ""}" title="seventh">7</button>`;
  placeMenu(menu, anchor);
  menu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    menu.hidden = true;
    if (b.dataset.q) setChord(si, k, cur.d, cur.q === "7" || cur.q === "dom7" ? null : "7");
    else setChord(si, k, +b.dataset.d, cur.q && cur.q !== "dom7" ? cur.q : null);
  }));
}
function placeMenu(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  menu.hidden = false;
  const below = r.bottom + 4 + menu.offsetHeight < innerHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left)) + "px";
  menu.style.top = Math.max(8, below ? r.bottom + 4 : r.top - menu.offsetHeight - 4) + "px";
}
// A BAR'S CHORD, CHANGED: the section takes its own chart (section.prog, a
// chord a bar), and the band FOLLOWS a chart (alphabet.harmony "cycle") —
// a modal genre that had nothing to follow starts following yours.
function setChord(si, k, d, q) {
  const sc = DOC.form.sections[si];
  const bars = secChordObjs(si);
  const n = secBars(si);
  const chart = Array.from({ length: n }, (_, i) => ({ ...(bars[i] || bars[bars.length - 1] || { d: 0 }) }));
  chart[k] = { d, q: q || null };
  writeChart(sc, chart);
  if (DOC.alphabet.harmony !== "cycle") DOC.alphabet.harmony = "cycle";
  push(false); persist(); drawLanes();
  hearAt({ what: `${roleWord(si)} ${k + 1}: ${roman(d, q).replace(/<[^>]+>/g, "")}`, si });
}

/* ---------- THE STRUCTURE, MOVED (copy, remove, move, a bar more or less) ----------
   A section is a row of the document (form.sections) and everything a member
   does there is keyed by its id (development[sid], a material map's [sid]), so
   a move is only the order changing, a copy is a new id carrying the
   original's words and phrases, and a removal drops the id everywhere. The
   count-in (when there is one) stays last. */
function structureChanged(what, si) {
  setLoopOnly(null); $("loopSec").checked = false;
  syncCount();
  push(false); persist(); shadeKey = "";
  drawLanes();
  if (si != null) hearAt({ what, si });
}
function freshId() {
  const ids = new Set(DOC.form.sections.map((x) => x.id));
  let k = DOC.form.sections.length;
  while (ids.has("s" + k)) k++;
  return "s" + k;
}
function dupSection(si) {
  const secs = DOC.form.sections, sc = secs[si];
  if (!sc || sc.id === COUNT_ID || secs.length >= 40) return;
  const id = freshId(), copy = JSON.parse(JSON.stringify(sc));
  copy.id = id;
  SRC.set(id, srcOf(sc.id));
  for (const v of DOC.voices) {
    if (v.development && v.development[sc.id] != null) v.development[id] = v.development[sc.id];
    if (v.material && typeof v.material === "object") { const n = NuDocument.materialAt(v, sc.id); if (n) v.material[id] = n; }
  }
  secs.splice(si + 1, 0, copy);
  if (FOCUS > si) FOCUS++;
  structureChanged(`${roleWord(si + 1)}`, si + 1);
}
function delSection(si) {
  const secs = DOC.form.sections, sc = secs[si];
  if (!sc || sc.id === COUNT_ID || secs.filter((x) => x.id !== COUNT_ID).length <= 1) return;
  if (playing) stop();
  secs.splice(si, 1);
  for (const v of DOC.voices) {
    if (v.development) delete v.development[sc.id];
    if (v.material && typeof v.material === "object") delete v.material[sc.id];
  }
  FOCUS = FOCUS === si ? -1 : FOCUS > si ? FOCUS - 1 : FOCUS;
  structureChanged("");
}
function moveSection(from, to) {
  const secs = DOC.form.sections;
  const last = secs.findIndex((x) => x.id === COUNT_ID);
  const lim = last < 0 ? secs.length : last;
  to = Math.max(0, Math.min(lim, to));
  if (to === from || to === from + 1) return;
  const [sc] = secs.splice(from, 1);
  const at = to > from ? to - 1 : to;
  secs.splice(at, 0, sc);
  if (FOCUS === from) FOCUS = at;
  structureChanged(roleWord(at), at);
}
function setBars(si, n) {
  const sc = DOC.form.sections[si];
  n = Math.max(1, Math.min(16, n | 0));
  if (!sc || n === secBars(si)) return;
  const per = secBars(si) / Math.max(1, sc.bars);     // bars a document "bar" is here (1 on every page so far)
  sc.bars = Math.max(1, Math.round(n / (per || 1)));
  if (Array.isArray(sc.prog)) {
    const was = secChordObjs(si);
    if (was.length) writeChart(sc, Array.from({ length: n }, (_, i) => was[Math.min(i, was.length - 1)]));
  }
  structureChanged(`${roleWord(si)}: ${n}`, si);
}

/* ---------- THE PHRASES A MEMBER HAS (a bank: A, B, C …) ----------
   What it reads anywhere, in the order first met, plus any it made here; a
   section's invocation picks one, or rests. A new phrase starts as a copy of
   the one open, and the section in focus takes it. */
const BANK = [[], [], [], []];
function phrasesOf(m) {
  if (!members[m]) return [];
  for (const c of cellsOf(m)) if (!BANK[m].includes(c.name)) BANK[m].push(c.name);
  return BANK[m].filter((n) => DOC.material.cells[n]);
}
function letterOf(m, name) {
  const i = phrasesOf(m).indexOf(name);
  return i < 0 ? "~" : String.fromCharCode(65 + (i % 26));
}
function setPhraseAt(m, si, name) {
  const v = members[m], sc = DOC.form.sections[si];
  if (!v || !sc) return;
  if (name === null) {                     // a rest
    const w = devWords(m).find((o) => OUT.test(o.value) && !o.disabled);
    if (w) setDev(m, sc.id, [w.value]);
    return;
  }
  if (m === 1 && pendingBass && name === CELL) pendingBass = false;
  const def = NuDocument.materialAt(v, sc.id);
  if (typeof v.material !== "object" || v.material == null) v.material = { "": typeof v.material === "string" ? v.material : name };
  v.material[sc.id] = name;
  if (def === undefined && !v.material[""]) v.material[""] = name;
  if (isOut((v.development || {})[sc.id])) v.development[sc.id] = ABSENT(m);
  push(false); persist();
  if (SEL === m && FOCUS === si && CELL !== name) openCell(m, name); else drawLanes();
  hearAt({ what: `${roleWord(si)}: ${letterOf(m, name)}`, m, si });
}
function newPhrase(m) {
  const v = members[m], src = CELL && DOC.material.cells[CELL];
  if (!v || !src) return;
  let k = phrasesOf(m).length, nn;
  do { nn = `${v.name}.${String.fromCharCode(97 + (k % 26))}${k >= 26 ? k : ""}`; k++; } while (DOC.material.cells[nn]);
  DOC.material.cells[nn] = JSON.parse(JSON.stringify(src));
  BANK[m].push(nn);
  const si = FOCUS >= 0 ? FOCUS : DOC.form.sections.findIndex((sc) => NuDocument.materialAt(v, sc.id) === CELL);
  if (si >= 0) { FOCUS = si; setPhraseAt(m, si, nn); }
  openCell(m, nn);
}
function openPhraseMenu(m, si, anchor) {
  const menu = $("wordMenu"), cur = NuDocument.materialAt(members[m], DOC.form.sections[si].id);
  const out = isOut((members[m].development || {})[DOC.form.sections[si].id]);
  const names = phrasesOf(m);
  menu.className = "wordmenu phrasemenu";
  menu.style.setProperty("--mc", COL[m]);
  menu.innerHTML = names.map((n) => `<button role="menuitem" data-n="${n}" class="${n === cur && !out ? "on" : ""}"><b>${letterOf(m, n)}</b><canvas></canvas></button>`).join("")
    + `<button role="menuitem" data-rest="1" class="${out ? "on" : ""}" title="rest">${icon("volume-x")}</button>`;
  placeMenu(menu, anchor);
  menu.querySelectorAll("button[data-n]").forEach((b) => drawCell(b.querySelector("canvas"), DOC.material.cells[b.dataset.n], COL[m]));
  menu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    menu.hidden = true;
    setPhraseAt(m, si, b.dataset.rest ? null : b.dataset.n);
  }));
}
// a cell drawn small: its notes as written
function drawCell(cv, c, color) {
  if (!cv || !c) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 56, h = cv.clientHeight || 22;
  cv.width = w * dpr; cv.height = h * dpr;
  const cx = cv.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = color;
  const ns = cellNotes(c);
  if (!ns.length) return;
  const L = c.kind === "drum" ? Math.max(...Object.values(c.lanes).map((a) => a.length), 16) : c.deg.length;
  if (c.kind === "drum") {
    const rows = DRUM_ROWS.map(([k]) => k).filter((k) => c.lanes[k] && c.lanes[k].some(Boolean));
    const rh = h / Math.max(1, rows.length);
    for (const [at, , k] of ns) { const r = rows.indexOf(k); if (r >= 0) cx.fillRect(at / L * w, r * rh + 1, Math.max(1.5, w / L - 0.5), Math.max(1.5, rh - 2)); }
    return;
  }
  let lo = 99, hi = -99;
  for (const [, , d] of ns) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
  const rng = Math.max(4, hi - lo), nh = Math.max(1.5, Math.min(3, h / (rng + 2)));
  for (const [at, len, d] of ns) cx.fillRect(at / L * w, h - nh - (d - lo) / rng * (h - nh - 1) - 0.5, Math.max(1.5, len / L * w - 0.6), nh);
}
const OUT = /^(out|nodrums|nobass|tacet|rest|silent)$/;
// a section's word may be a chain ("busy + octaves", songs.js CHAINSEP): out if any link is
const CHAINSEP = (window.NuSongs && window.NuSongs.CHAINSEP) || " + ";
const chainOf = (w) => String(w == null ? "" : w).split(CHAINSEP).map((x) => x.trim()).filter(Boolean);
const isOut = (w) => chainOf(w).some((x) => OUT.test(x));
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
    const out = !v || (si >= 0 && isOut(w));
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
  });
  // the notes floating up, each over its own member
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], age = t - f.born;
    if (age > 900 || !playing) { floats.splice(i, 1); continue; }
    const cx = cards[f.m].cv.getContext("2d");
    quaver(cx, f.x + ((age / 120 | 0) % 2), 24 - age / 40, mix(COL[f.m], BG, age / 10));
  }
  // the countdown to hearing a change
  if (SEL >= 0 && !$("drawer").hidden && t - hearPainted > 250) { hearPainted = t; paintHear(); }
  // the song's playhead, through the block playing, and that block lit
  const ph = $("playhead");
  const blk = si >= 0 && !READ ? document.querySelector(`#secs .sec[data-si="${si}"]`) : null;
  if (now >= 0 && blk && bar) {
    const first = SCORE.bars.findIndex((x) => x.si === si);
    let beats = 0, done = 0;
    for (let i = first; i < SCORE.bars.length && SCORE.bars[i].si === si; i++) { beats += SCORE.bars[i].beats; if (i < bi) done += SCORE.bars[i].beats; }
    const p = beats ? Math.min(1, (done + now - bar.beat) / beats) : 0;
    const br = blk.getBoundingClientRect(), sr = $("song").getBoundingClientRect();
    ph.hidden = false;
    ph.style.transform = `translateX(${(br.left - sr.left + p * br.width).toFixed(1)}px)`;
    litSec(si, bi - first);
  } else { ph.hidden = true; litSec(-1, 0); }
  // the roll's playhead: where the member's motif is, in the cell it reads now
  if (SEL >= 0 && roll && now >= 0 && bar) rollHead(now, bar, si);
  else if (roll) roll.setPlayhead(-1);
  if (!$("drawer").hidden) paintShadow(now, si);
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
  const bi = BANK[m].indexOf(name);
  if (bi >= 0) BANK[m][bi] = nn; else BANK[m].push(nn);
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

// A ROW IS A STEP OVER THE CHORD, NOT A NOTE (Paul, 2026-11-02: "just intervals
// makes more sense right"). kernel.js render() moves a line onto each chord's
// root ("FOLLOW THE CHORD … a line is transposed by the bar's root"), and a
// written bass reads its degree OVER the chord sounding at that step (bass():
// "a written 0 is the chord's own bass note"), so a note name was only ever
// true over the home chord. 1 is the chord's root (the key's, where the song
// has no changes); ' is an octave up, , an octave down.
const INTERVAL = ["1", "♭2", "2", "♭3", "3", "4", "♯4", "5", "♭6", "6", "♭7", "7"];
function intervalName(d) {
  const st = modeSteps(), n = st.length;
  const o = Math.floor(d / n), i = ((d % n) + n) % n;
  return INTERVAL[st[i] % 12] + (o > 0 ? "'".repeat(o) : o < 0 ? ",".repeat(-o) : "");
}
const DRUM_ROWS = [["x", "crash"], ["r", "ride"], ["o", "open hat"], ["h", "hat"], ["f", "pedal hat"],
  ["t", "tom hi"], ["m", "tom mid"], ["l", "tom lo"], ["c", "clap"], ["p", "rim"], ["s", "snare"], ["k", "kick"]];
const DRUM_SHORT = { x: "crash", r: "ride", o: "open", h: "hat", f: "pedal", t: "tom 1", m: "tom 2", l: "tom 3", c: "clap", p: "rim", s: "snare", k: "kick" };

function stepsPerBar() {
  try { return K.stepsIn(GENRES[GK + 0]) / (GENRES[GK + 0].rate || 1) || 16; } catch (e) { return 16; }
}

function openCell(m, name) {
  CELL = name;
  shadeKey = ""; if (roll) roll.shadow = [];
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
      rows.push({ key: d, label: intervalName(d), scale: true, tonic: ((d % n) + n) % n === 0 });
    roll.set({ rows, notes, steps, beat, bar, color: COL[m], drum: false });
    roll.scrollToRow(Math.round((lo + hi) / 2));
  }
  renderTabs();
  shadeKey = "";
  paintPoly(m);
  drawLanes();
}

/* ---------- MONO OR CHORDS (Paul, 2026-11-02: "how do I switch to poly, like the
   pad mode?") ----------
   A phrase is one line — the engine keeps one note per step — but a member can
   PLAY it as chords: `stab` sounds the whole chord on each of the phrase's
   notes (you write the rhythm; the band voices the harmony, kernel.js
   chordLock), `pad` holds one chord a bar from the phrase's first note. The
   member's part (avail.js cast.part), so it holds in every section. The keys
   and the lead only: the bass is a line and the drummer a kit. */
const CHORDPART = new Set(["stab", "pad"]);
function paintPoly(m) {
  const el = $("tPoly"), v = members[m];
  el.hidden = !(v && v.kind === "line");
  if (el.hidden) return;
  const part = partOf(v), on = CHORDPART.has(part) ? part : "mono";
  [...el.children].forEach((b) => b.setAttribute("aria-checked", String(b.dataset.p === on)));
}
function setPoly(m, want) {
  const v = members[m];
  if (!v || v.kind !== "line") return;
  const b = BASE && BASE.voices.find((x) => x.name === v.name);
  const orig = (b && b.cast && b.cast.part) || "line";
  // back to one line: the member's own part, or a riff if it was born a chord part
  const part = want === "mono" ? (CHORDPART.has(orig) ? "riff" : orig) : want;
  if (part === partOf(v)) return;
  window.NuAvail.SHEETS["cast.part"].set(DOC, { voice: v.name }, part);
  push(false);
  persist();
  paintPoly(m);
  drawLanes();
  hearAt({ what: `${whoOf(m).toLowerCase()} ${want === "mono" ? "plays one line" : want === "pad" ? "holds a chord a bar" : "plays chords"}`, m });
}

/* ---------- THE SECTIONS AND THEIR TRANSFORMATIONS (Paul, 2026-11-02: "give every
   transformation an icon. I can turn them on and off per section") ----------
   A column a section, for the member open: lit where it reads the phrase you
   are editing, an icon for every transformation the section applies (a chain:
   songs.js CHAINSEP), each one a toggle. One you turn off stays on the column,
   dim, so it can come back. The words and the menu are the development
   sheets' own (avail.js dev.line / dev.kit / dev.bass); the bass takes one. */
const devSheet = (m) => (m === 0 ? "dev.kit" : m === 1 ? "dev.bass" : "dev.line");
const kindOf = (m) => (m === 0 ? "drums" : m === 1 ? "bass" : "line");
const ABSENT = (m) => (m >= 2 ? "as written" : "");
const OFFW = new Map();      // "m|sid" -> words turned off this visit, kept on the column, dim
function devWords(m) {
  try {
    const r = window.NuAvail.optionsFor(DOC, { voice: members[m].name, section: DOC.form.sections[0].id }, devSheet(m), window.NuGates, INSTR_ENV);
    return r.options.filter((o) => o.value && o.value !== "as written");
  } catch (e) { return []; }
}
function devChain(m, sid) { return chainOf((members[m].development || {})[sid]).filter((w) => w !== "as written"); }
function setDev(m, sid, words) {
  const v = members[m];
  if (!v.development) v.development = {};
  const w = m === 1 ? words.slice(-1) : words;
  v.development[sid] = w.length ? w.slice(0, MAXW).join(CHAINSEP) : ABSENT(m);
  push(false);
  persist();
  shadeKey = "";
  drawLanes();
  const si = DOC.form.sections.findIndex((x) => x.id === sid);
  hearAt({ what: `${roleWord(si)}: ${w.length ? w.join(" + ") : "as written"}`, m, si });
}
const OFFE = new Map();      // "sid|intro" -> the edge turned off this visit, kept on the column, dim
function edgeLabel(f, w) {
  try { return (window.NuAvail.SHEETS["form." + f].values().find((o) => o.value === w) || {}).label || w; } catch (e) { return w; }
}
function setEdge(sc, f, w) {
  if (!w && sc[f]) OFFE.set(sc.id + "|" + f, sc[f]);
  sc[f] = w || null;
  push(false);
  persist();
  drawLanes();
  const si = DOC.form.sections.indexOf(sc);
  hearAt({ what: `${roleWord(si)}: ${w ? (f === "intro" ? "comes in with " : "goes out with ") + edgeLabel(f, w) : "no " + f}`, m: 0, si });
}
let litAt = -2, litBar = -1;
function litSec(si, k) {
  const host = $("secs");
  if (si !== litAt) {
    litAt = si; litBar = -1;
    host.querySelectorAll(".sec.now").forEach((c) => c.classList.remove("now"));
    const col = si >= 0 ? host.querySelector(`.sec[data-si="${si}"]`) : null;
    if (col) {
      col.classList.add("now");
      const l = col.offsetLeft, r = l + col.offsetWidth;
      if (l < host.scrollLeft || r > host.scrollLeft + host.clientWidth) host.scrollLeft = Math.max(0, l - 40);
    }
  }
  if (k === litBar) return;
  litBar = k;
  const col = si >= 0 ? host.querySelector(".sec.now") : null;
  if (!col) return;
  // the chord sounding: the bar's numeral
  col.querySelectorAll(".ch").forEach((c) => c.classList.toggle("on", +c.dataset.k === k));
}
function openWordMenu(m, sid, anchor) {
  const menu = $("wordMenu"), cur = devChain(m, sid);
  const sc = DOC.form.sections.find((x) => x.id === sid);
  // the drummer's menu also has the section's way in and out
  const edgeItems = (f) => {
    let vals = [];
    try { vals = window.NuAvail.SHEETS["form." + f].values().filter((o) => o.value); } catch (e) { return ""; }
    return `<hr>` + vals.map((o) =>
      `<button role="menuitem" data-e="${f}" data-v="${o.value}" class="${sc && sc[f] === o.value ? "on" : ""}" title="${o.label}">${icon(edgeIcon(o.value))}<b>${f === "intro" ? "›" : "‹"}</b></button>`).join("");
  };
  // AN ICON A WORD, the word its tooltip; five on is the most (the rest grey)
  const full = cur.filter((x) => !OUT.test(x)).length >= MAXW;
  menu.className = "wordmenu icons";
  menu.style.setProperty("--mc", COL[m]);
  menu.innerHTML = devWords(m).filter((o) => o.value && o.value !== "as written").map((o) => {
    const ic = wordIcon(kindOf(m), o.value), on = cur.includes(o.value);
    const off = o.disabled || (full && !on);
    return `<button role="menuitem" data-w="${o.value.replace(/"/g, "&quot;")}" class="${on ? "on" : ""}"${off ? " disabled" : ""} title="${(o.label + (o.disabled && o.why ? " — " + o.why : "")).replace(/"/g, "&quot;")}">${icon(ic.name)}${ic.badge ? `<b>${ic.badge}</b>` : ""}</button>`;
  }).join("") + (m === 0 && sc ? edgeItems("intro") + edgeItems("outro") : "");
  menu.querySelectorAll("button[data-e]").forEach((b) => b.addEventListener("click", () => {
    menu.hidden = true;
    setEdge(sc, b.dataset.e, sc[b.dataset.e] === b.dataset.v ? null : b.dataset.v);
  }));
  placeMenu(menu, anchor);
  menu.querySelectorAll("button[data-w]").forEach((b) => b.addEventListener("click", () => {
    const w = b.dataset.w, c = devChain(m, sid);
    menu.hidden = true;
    setDev(m, sid, c.includes(w) ? c.filter((x) => x !== w) : m === 1 ? [w] : [...c, w]);
  }));
}

/* ---------- WHEN YOU WILL HEAR IT (Paul: "hear the difference and have it tell me
   when I'll be able to hear the difference") ----------
   An edit reaches the engine at the next bar it has not rendered (its runway,
   health().runwaySec), and is only audible where it plays: a phrase in the
   sections that read it, a transformation in its own section. So the page
   says which bar that is and counts down to it, and offers to go there now —
   a jump re-walks from the new place with the new score, a bar later. */
let HEAR = null, hearPainted = 0;      // { what, m, cell|null, si|null, at: beat, sec: section index }
function nextHeard(m, cell, si, from) {
  if (!SCORE) return null;
  const sid = (i) => DOC.form.sections[i].id;
  const ok = (b) => (si != null ? b.si === si : (cell == null || NuDocument.materialAt(members[m], sid(b.si)) === cell))
    && (m < 0 || !isOut((members[m].development || {})[sid(b.si)]));
  return SCORE.bars.find((b) => b.beat >= from && ok(b)) || SCORE.bars.find((b) => ok(b)) || null;
}
function hearAt({ what, m = -1, cell = null, si = null }) {
  const now = playing ? beatNow() : -1;
  const land = now >= 0 ? now + (health().runwaySec || 0) * bpm / 60 : 0;
  const bar = nextHeard(m, cell, si, land);
  HEAR = { what, m, cell, si, at: bar ? Math.max(bar.beat, land) : null, sec: bar ? bar.si : null, t: performance.now() };
  paintHear();
}
function paintHear() {
  const el = $("zHear"), jump = $("zJump");
  if (!HEAR) { el.innerHTML = ""; jump.hidden = true; return; }
  const now = playing ? beatNow() : -1;
  el.title = HEAR.what;
  if (HEAR.at == null) { el.innerHTML = `${icon("ear")} ${icon("x")}`; jump.hidden = true; return; }
  const where = `<b>${roleWord(HEAR.sec)}</b>`;
  if (!playing) {
    el.innerHTML = `${icon("ear")} ${where}`;
    jump.hidden = false; jump.innerHTML = icon("play");
  } else if (now >= 0 && now < HEAR.at) {
    const sec = Math.max(0, (HEAR.at - now) * 60 / bpm);
    el.innerHTML = `${icon("clock")} <b class="n">${Math.ceil(sec)}</b> ${where}`;
    jump.hidden = false; jump.innerHTML = icon("play");
  } else if (now >= HEAR.at) {
    el.innerHTML = `${icon("ear")} ${where}`;
    el.classList.add("now");
    jump.hidden = true;
    if (now > HEAR.at + 16) { HEAR = null; el.classList.remove("now"); }
    return;
  }
  el.classList.remove("now");
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
  hearAt({ what: `${whoOf(m).toLowerCase()} ${letterOf(m, name)}`, m, cell: name });
  if (SEL === m) { renderTabs(m); openCell(m, name); }
}

// EVERY SOURCE PHRASE, ONE TAP AWAY (Paul, 2026-11-02: "quickly edit all source
// phrases!!!! And know which one I'm editing"): a tab a phrase, across the band
// — the drummer's beat, the bass's line, each member's main and chorus — in
// the member's colour, the open one lit.
function phraseLabel(m, name) {
  const many = cellsOf(m).length > 1;
  const secs = (cellsOf(m).find((c) => c.name === name) || { secs: [] }).secs;
  const chorus = many && secs.length && secs.every((i) => HOOKY.includes(DOC.form.sections[i].role));
  return m === 0 ? "beat" : m === 1 ? "line" : chorus ? "chorus" : "main";
}
function renderTabs() {
  const host = $("motifTabs");
  host.replaceChildren();
  const m = SEL;
  if (m < 0 || !members[m]) return;
  host.style.setProperty("--mc", COL[m]);
  const names = phrasesOf(m);
  if (m === 1 && pendingBass && CELL && !names.includes(CELL)) names.unshift(CELL);
  for (const name of names) {
    const b = document.createElement("button");
    b.dataset.cell = name; b.dataset.m = m;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(name === CELL));
    b.className = "pcard";
    const secs = (cellsOf(m).find((c) => c.name === name) || { secs: [] }).secs;
    b.title = secs.map((i) => roleWord(i)).join(" · ");
    b.innerHTML = `<b>${letterOf(m, name)}</b><canvas></canvas><i style="--n:${secs.length}"></i>`;
    b.addEventListener("click", () => openCell(m, name));
    host.appendChild(b);
    drawCell(b.querySelector("canvas"), DOC.material.cells[name], name === CELL ? "#0e0e14" : COL[m]);
  }
  if (CELL && DOC.material.cells[CELL]) {
    const add = document.createElement("button");
    add.className = "pcard add"; add.title = "a new phrase (a copy of this one)";
    add.innerHTML = icon("plus");
    add.addEventListener("click", () => newPhrase(m));
    host.appendChild(add);
  }
}

function select(m, atSi) {
  SEL = m;
  const drawer = $("drawer");
  if (m < 0 || !members[m]) {
    drawer.hidden = true;
    SEL = -1;
    refreshCards();
    showSheet();
    return;
  }
  drawer.hidden = false;
  drawer.style.setProperty("--mc", COL[m]);
  document.body.style.setProperty("--mc", COL[m]);
  $("mine").checked = MINE === m;
  fillInstr(m);
  const cells = cellsOf(m);
  let si = atSi;
  if (si == null) {
    const now = playing ? songBeatNow() : -1;
    const bi = now >= 0 ? sectionAtBeat(now) : -1;
    // stopped: the section chosen before, else the first this member plays in
    const plays = (i) => secId(i) !== COUNT_ID && !isOut((members[m].development || {})[secId(i)]) && SCORE && SCORE.parts[m].some((n) => SCORE.bars.some((b) => b.si === i && n.beat >= b.beat && n.beat < b.beat + b.beats));
    si = bi >= 0 ? SCORE.bars[bi].si : FOCUS >= 0 ? FOCUS : Math.max(0, DOC.form.sections.findIndex((x, i) => plays(i)));
  }
  FOCUS = si;
  if (m === 1 && !cells.length) {
    // the bass's own line, written out: what it plays, as a cell it does not
    // read until the first edit (so opening it changes nothing you hear)
    const name = "bassline";
    if (!DOC.material.cells[name]) DOC.material.cells[name] = seedBass(Math.round(stepsPerBar()) * 2 || 32);
    CELL = name;
    pendingBass = true;
    refreshCards();
    openCell(m, name);
  } else {
    pendingBass = false;
    const here = NuDocument.materialAt(members[m], secId(si));
    const cur = (here && DOC.material.cells[here]) ? here : (cells[0] || {}).name;
    refreshCards();
    if (cur) openCell(m, cur);
  }
  showSheet();
}
let pendingBass = false;

/* THE BASS, WRITTEN OUT (Paul, 2026-11-02: "compose the bass in the piano roll
   even if it is just playing after the scales"). The bass has no cell until a
   hand writes one: it plays the genre's line over the chords. So the roll
   opens on that line — its first verse, as the score has it — spelled the way
   a written bass cell is read (kernel.js bass(): a degree OVER the chord
   sounding at that step, 0 = the chord's bass note). Onsets quantized to the
   step; the octave chosen so the line's most frequent degree sits in 0..n-1,
   which makes the root 1 and keeps the contour. */
function chordDegAt(si, k) {
  const bar = secChords(si)[k];
  return bar && bar.length ? bar[0] : 0;
}
// a sounding pitch as a degree of the key (octaves counted; off the mode: the nearest step)
function degOfMidi(midi) {
  const st = modeSteps(), n = st.length, rel = midi - tonicPc(), o = Math.floor(rel / 12), pc = ((rel % 12) + 12) % 12;
  let best = 0;
  st.forEach((x, i) => { if (Math.abs(x - pc) < Math.abs(st[best] - pc)) best = i; });
  return o * n + best;
}
function seedBass(steps) {
  const c = { kind: "line", deg: new Array(steps).fill(0), play: new Array(steps).fill("r"),
    vel: new Array(steps).fill(6), acc: new Array(steps).fill(0) };
  if (!SCORE || !members[1]) return c;
  const plays = (sc) => !isOut((members[1].development || {})[sc.id] || "");
  const secs = DOC.form.sections;
  const si = Math.max(0, secs.findIndex((sc) => sc.role === "verse" && plays(sc)));
  const bars = SCORE.bars.filter((b) => b.si === si);
  if (!bars.length) return c;
  const spb = Math.round(stepsPerBar()) || 16, n = modeSteps().length, degOf = degOfMidi;
  const got = [];
  for (const nt of SCORE.parts[1]) {
    const at = Math.round((nt.beat - bars[0].beat) * 4);
    if (at < 0) continue;
    if (at >= steps) break;
    if (got.length && got[got.length - 1].at === at) continue;
    got.push({ at, len: Math.max(1, Math.round(nt.dur * 4)), deg: degOf(nt.midi) - chordDegAt(si, Math.floor(at / spb)) });
  }
  if (!got.length) return c;
  const count = new Map();
  for (const g of got) count.set(g.deg, (count.get(g.deg) || 0) + 1);
  const common = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const shift = Math.floor(common / n) * n;
  got.forEach((g, j) => {
    const end = Math.min(steps, g.at + g.len, j + 1 < got.length ? got[j + 1].at : steps);
    c.play[g.at] = "n";
    for (let i = g.at; i < end; i++) { c.deg[i] = g.deg - shift; if (i > g.at) c.play[i] = "h"; }
  });
  return c;
}

/* ---------- the instrument: the main app's own three menus (avail.js SHEETS) ----------
   A drummer picks a kit, the bass a bass, the other two anything in the fleet.
   The options, the greyed ones and their reasons are avail.js's, so this page
   cannot offer a sound the engine would not seat. */
const INSTR_ENV = { fleet: NATIVE };
const sheetOf = (v) => (v.kind === "drums" ? "sound.drumkit" : v.kind === "bass" ? "sound.bassinstrument" : "sound.instrument");
function instrOptions(doc, v) {
  try { return window.NuAvail.optionsFor(doc, { voice: v.name }, sheetOf(v), window.NuGates, INSTR_ENV); }
  catch (e) { return null; }
}
function fillInstr(m) {
  if (m !== SEL) return;
  const sel = $("instr"), v = members[m];
  sel.replaceChildren();
  const r = v && instrOptions(DOC, v);
  sel.disabled = !r || !r.options.length;
  if (sel.disabled) return;
  const groups = new Map();
  for (const o of r.options) {
    const el = document.createElement("option");
    el.value = o.value; el.textContent = o.label;
    if (o.disabled) { el.disabled = true; el.title = o.why || ""; }
    const g = o.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(el);
  }
  for (const [g, els] of groups) {
    if (!g) { sel.append(...els); continue; }
    const og = document.createElement("optgroup");
    og.label = g; og.append(...els); sel.appendChild(og);
  }
  sel.value = r.value == null ? "" : r.value;
}
function setInstr(m, value) {
  const v = members[m];
  if (!v) return;
  window.NuAvail.SHEETS[sheetOf(v)].set(DOC, { voice: v.name }, value);
  push(false);
  persist();
  fillInstr(SEL);      // a kit or a pool choice can grey another's options
  refreshCards();
  // no restart: the engine seats it at the next bar it renders, and the rest of the band plays on
  say(`${whoOf(m).toLowerCase()} plays ${pretty(instrumentOf(m)).toLowerCase()}`);
  if (!$("drawer").hidden) hearAt({ what: `${whoOf(m).toLowerCase()} on ${pretty(instrumentOf(m)).toLowerCase()}`, m });
}
/* ---------- KEY, MODE, SCALE (Paul, 2026-11-02: "tweak a few phrases, change key
   and scale and mode, and have a different song"). The main app's own three
   menus (avail.js alphabet.key / .mode / .scale), so nothing is offered the
   document cannot hold. Every phrase is written in steps, so the whole band
   moves with them. ---------- */
const TONAL = [["key", "alphabet.key"], ["mode", "alphabet.mode"], ["scale", "alphabet.scale"]];
function fillTonal() {
  for (const [id, sheet] of TONAL) {
    const sel = $(id);
    let r = null;
    try { r = window.NuAvail.optionsFor(DOC, {}, sheet, window.NuGates, INSTR_ENV); } catch (e) { /* no menu: leave it */ }
    sel.replaceChildren();
    if (!r) { sel.disabled = true; continue; }
    const groups = new Map();
    for (const o of r.options) {
      const el = document.createElement("option");
      el.value = o.value; el.textContent = id === "scale" && !o.value ? "scale: the mode's" : o.label;
      if (o.disabled) { el.disabled = true; el.title = o.why || ""; }
      const g = o.group || "";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(el);
    }
    for (const [g, els] of groups) {
      if (!g) { sel.append(...els); continue; }
      const og = document.createElement("optgroup"); og.label = g; og.append(...els); sel.appendChild(og);
    }
    sel.value = r.value == null ? "" : String(r.value);
    sel.disabled = false;
  }
}
function setTonal(sheet, value) {
  window.NuAvail.SHEETS[sheet].set(DOC, {}, value);
  push(false);
  persist();
  fillTonal();
  if (SEL >= 0 && CELL) openCell(SEL, CELL);
  drawLanes();       // the rows' names are steps; the roll redraws with the song
  const A = DOC.alphabet || {};
  say(`in ${degName(0)} ${A.mode || ""}${A.scale ? " (" + A.scale + ")" : ""}`);
  hearAt({ what: `the key, ${degName(0)} ${A.mode || ""}` });
}

// ← → : the next member who plays, round the band (the ones sitting this genre out skipped)
function flip(d) {
  for (let k = 1; k <= 4; k++) {
    const m = (((SEL < 0 ? (d > 0 ? -1 : 0) : SEL) + d * k) % 4 + 4) % 4;
    if (members[m]) { select(m); return; }
  }
}

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

/* ---------- THE SHADOW (Paul, 2026-11-02: "show the transformation as a shadow
   under the phrase so I can see what's happening") ----------
   What the band plays from the open phrase in one section — the score's own
   notes, so every transformation, the swing and the humanising are in it —
   spelled back onto the roll's rows: a line's pitch as a step over the chord
   it sounds on (the kernel's rule), a drum hit as its lane. Which section:
   the one hovered below; else, while it plays, the one playing (and the
   repeat of the phrase the playhead is in); else the first that transforms
   it. The octave is set where the phrase is heard as written, so a
   transformation that moves it an octave shows the octave. */
const GM_ROW = { 35: "k", 36: "k", 38: "s", 40: "s", 37: "p", 39: "c", 42: "h", 44: "f", 46: "o",
  49: "x", 52: "x", 55: "x", 57: "x", 51: "r", 53: "r", 59: "r", 48: "t", 50: "t", 45: "m", 47: "m", 41: "l", 43: "l" };
let shadeHover = -1, shadeKey = "", shadeScore = null;
const phraseLen = (c) => (c.kind === "drum" ? Math.max(...Object.values(c.lanes).map((a) => a.length), 16) : c.deg.length);
function heardIn(m, si, rep, L) {
  const bars = SCORE.bars.filter((b) => b.si === si);
  if (!bars.length) return [];
  const s0 = bars[0].beat + rep * L / 4, s1 = s0 + L / 4;
  const out = [];
  for (const nt of SCORE.parts[m]) {
    if (nt.beat < s0 - 0.01) continue;
    if (nt.beat >= s1 - 0.01) break;
    const at = (nt.beat - s0) * 4, len = Math.max(m === 0 ? 0.6 : 0.5, nt.dur * 4);
    if (m === 0) { const row = GM_ROW[nt.midi]; if (row) out.push({ at, len: Math.min(len, 1), row }); continue; }
    // where it SOUNDS in the key: the kernel moves a line onto each chord by
    // its own rule (by degrees or by semitones, folded the nearer way, long
    // notes nudged onto chord tones), so the shadow does not undo it — the
    // section's chords are written under it instead (renderSecs)
    let k = 0;
    while (k + 1 < bars.length && bars[k + 1].beat <= nt.beat + 0.01) k++;
    out.push({ at, len, row: degOfMidi(nt.midi), home: chordDegAt(si, k) % modeSteps().length === 0 });
  }
  return out;
}
// the octave: where the phrase is heard untransformed, the shadow's notes on the written ones
function shadeShift(m, c, L) {
  if (m === 0 || c.kind === "drum") return 0;
  const n = modeSteps().length, plain = DOC.form.sections.findIndex((sc) =>
    NuDocument.materialAt(members[m], sc.id) === CELL && !devChain(m, sc.id).length && !isOut((members[m].development || {})[sc.id]));
  const votes = new Map();
  // ...counted on the tonic's bars only: there the line sits where it is written
  const heard = plain >= 0 ? heardIn(m, plain, 0, L) : [];
  const home = heard.filter((g) => g.home);
  for (const g of home.length ? home : heard) {
    const i = Math.round(g.at);
    if (Math.abs(g.at - i) > 0.4 || c.play[i] !== "n") continue;
    const d = Math.round((g.row - (c.deg[i] | 0)) / n) * n;
    votes.set(d, (votes.get(d) || 0) + 1);
  }
  if (votes.size) return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // nowhere as written: the shadow's middle on the phrase's middle
  const mid = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const w = []; c.play.forEach((p, i) => { if (p === "n") w.push(c.deg[i] | 0); });
  const all = DOC.form.sections.map((sc, si) => (NuDocument.materialAt(members[m], sc.id) === CELL ? heardIn(m, si, 0, L) : [])).flat();
  return w.length && all.length ? Math.round((mid(all.map((g) => g.row)) - mid(w)) / n) * n : 0;
}
function paintShadow(now, si) {
  const el = $("zShadow");
  if (SEL < 0 || !CELL || !SCORE || !roll || !members[SEL]) { el.textContent = ""; return; }
  const m = SEL, c = DOC.material.cells[CELL];
  if (!c) return;
  const L = phraseLen(c), reads = (i) => i >= 0 && NuDocument.materialAt(members[m], secId(i)) === CELL;
  // which bars: the section playing while it reads this phrase; else the one
  // chosen below; else the first that plays it
  let at = -1, rep = 0;
  if (now >= 0 && si >= 0 && reads(si)) {
    at = si;
    const first = SCORE.bars.find((x) => x.si === si);
    rep = Math.max(0, Math.floor(((now - first.beat) * 4 + 0.01) / L));
  } else if (reads(FOCUS) || (FOCUS >= 0 && pendingBass)) at = FOCUS;
  else {
    const secs = DOC.form.sections.map((sc, i) => i).filter((i) => secId(i) !== COUNT_ID && reads(i));
    const plays = secs.filter((i) => !isOut((members[m].development || {})[secId(i)]) && heardIn(m, i, 0, L).length);
    at = plays[0] ?? secs[0] ?? -1;
  }
  const key = [m, CELL, at, rep, L, SHOWN.join("")].join("|");
  if (key === shadeKey && shadeScore === SCORE) return;
  shadeKey = key; shadeScore = SCORE;
  document.querySelectorAll("#secs .sec").forEach((col) => col.classList.toggle("shown", +col.dataset.si === at));
  if (at < 0) { roll.setShadow([]); roll.setLayers([]); roll.setRhythm([]); el.innerHTML = ""; return; }
  const shift = shadeShift(m, c, L);
  const mine = heardIn(m, at, rep, L).map((g) => (m === 0 ? g : { ...g, row: g.row - shift }));
  roll.setShadow(mine);
  // THE REST OF THE BAND IN THE SAME BARS: a pitched member's notes outlined
  // in its colour, folded by octaves to sit by this phrase; the drums (and,
  // under the drums, everybody) as ticks along the top — the rhythm to answer
  const layers = [], rhythm = [];
  const mid = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const myRows = mine.length ? mine.map((g) => g.row) : roll.notes.map((n) => n.row);
  const n7 = modeSteps().length;
  for (let k = 0; k < 4; k++) {
    if (k === m || !members[k] || !SHOWN[k]) continue;
    const hs = heardIn(k, at, rep, L);
    if (!hs.length) continue;
    if (k === 0 || m === 0) {
      const bars = SCORE.bars.filter((b) => b.si === at), s0 = bars.length ? bars[0].beat + rep * L / 4 : 0;
      const vel = new Map((SCORE.parts[k] || []).filter((nt) => nt.beat >= s0 - 0.01 && nt.beat < s0 + L / 4).map((nt) => [Math.round((nt.beat - s0) * 4 * 100), nt.vel]));
      rhythm.push({ color: COL[k], hits: hs.map((g) => ({ at: g.at, v: k === 0 ? (g.row === "k" ? 1 : g.row === "s" || g.row === "c" ? 0.75 : 0.35) : Math.min(1, (vel.get(Math.round(g.at * 100)) || 90) / 127) })) });
      continue;
    }
    const d = Number.isFinite(mid(myRows)) && myRows.length ? Math.round((mid(myRows) - mid(hs.map((g) => g.row - shift))) / n7) * n7 : 0;
    layers.push({ color: COL[k], notes: hs.map((g) => ({ at: g.at, len: g.len, row: g.row - shift + d })) });
  }
  roll.setRhythm(rhythm);
  roll.setLayers(layers);
  const ws = devChain(m, secId(at)).filter((x) => !OUT.test(x));
  const reps = Math.round(SCORE.bars.filter((b) => b.si === at).reduce((x, b) => x + b.beats, 0) * 4 / L);
  el.innerHTML = `<i></i><b>${roleWord(at)}</b>${reps > 1 ? `<span class="rep">${rep + 1}/${reps}</span>` : ""}`
    + ws.map((x) => icon(wordIcon(kindOf(m), x).name, x)).join("");
}

/* ---------- mute: "I'll play this part" ---------- */
function setMine(m, yes, quiet) {
  // the part that was yours goes back to the band, and this one is muted;
  // every other member's own mute (the M on its track) is left as it is
  const mute = (k, on) => {
    const v = members[k];
    if (!v) return;
    const d = { ...(v.desk || {}) };
    if (on) d.mute = true; else delete d.mute;
    if (Object.keys(d).length) v.desk = d; else delete v.desk;
  };
  if (MINE >= 0 && MINE !== m) mute(MINE, false);
  mute(m, yes);
  MINE = yes ? m : -1;
  syncCount();
  push(false);
  persist();
  refreshCards();
  showSheet();
  if (quiet) return;
  if (yes) say(`${whoOf(m).toLowerCase()} is muted — the part is yours${playing ? " (in a few seconds)" : ""}`);
  else say("everyone plays");
}

/* ---------- the staff ---------- */
let staff = null, staffRest = -0.001;
const shownPart = () => (READ ? PART : MINE);
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
  staff.options({ head: 0.38, ahead: prefs.ahead, names: prefs.names, chords: prefs.chords });
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
  staff.options({ head: 0.4, ahead: null, names: prefs.names, chords: prefs.chords });
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
  // any member may be muted on its track; the part that is yours always is
  if (MINE >= 0 && !(members[MINE] && members[MINE].desk && members[MINE].desk.mute)) return `member ${MINE} is yours and is not muted`;
  for (let m = 0; m < 4; m++) {
    const d = deskOf(m), c = cards[m];
    if (c && c.mb.getAttribute("aria-pressed") !== String(!!d.mute)) return `member ${m}'s M says ${c.mb.getAttribute("aria-pressed")}, its strip ${!!d.mute}`;
    if (c && c.sb.getAttribute("aria-pressed") !== String(!!d.solo)) return `member ${m}'s S says ${c.sb.getAttribute("aria-pressed")}, its strip ${!!d.solo}`;
  }
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
  if ($("play").getAttribute("aria-pressed") !== String(!!playing)) return `the play button says ${$("play").getAttribute("aria-pressed")} while ${playing ? "playing" : "stopped"}`;
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
  const ins = {};
  for (const v of DOC.voices) {
    const b = BASE.voices.find((x) => x.name === v.name);
    if (b && (v.instrument || "") !== (b.instrument || "")) ins[v.name] = v.instrument || "";
  }
  if (Object.keys(ins).length) st.i = ins;
  // what a member plays the phrase as (a line, chords, a pad), where you changed it
  const pk = {};
  for (const v of DOC.voices) {
    const b = BASE.voices.find((x) => x.name === v.name);
    // (the test song recasts its keys, so there every part is written down)
    if (b && v.kind === "line" && (TEST || partOf(v) !== partOf(b))) pk[v.name] = partOf(v);
  }
  if (Object.keys(pk).length) st.k = pk;
  // the strip's three hand controls, where they differ from the genre's own strip
  const dk = {}, three = (d) => ({ mute: !!(d && d.mute), solo: !!(d && d.solo), fader: (d && d.fader) || 0 });
  for (const v of DOC.voices) {
    const b = BASE.voices.find((x) => x.name === v.name);
    if (b && !same(three(v.desk), three(b.desk))) dk[v.name] = three(v.desk);
  }
  if (Object.keys(dk).length) st.d = dk;
  // the transformations a section applies, where you changed them
  const dv = {};
  for (const v of DOC.voices) {
    const b = BASE.voices.find((x) => x.name === v.name);
    if (!b) continue;
    for (const sc of DOC.form.sections) {
      const a = (v.development || {})[sc.id] || "", o = (b.development || {})[srcOf(sc.id)] || "";
      if (a !== o) (dv[v.name] || (dv[v.name] = {}))[sc.id] = a;
    }
  }
  if (Object.keys(dv).length) st.v = dv;
  // THE STRUCTURE, where you moved, copied or removed sections: the order of
  // ids, each with the generated section it is (or copies)
  const live = DOC.form.sections.filter((x) => x.id !== COUNT_ID);
  if (!same(live.map((x) => x.id), BASE.form.sections.map((x) => x.id))) st.o = live.map((x) => [x.id, srcOf(x.id)]);
  // a section's way in and out, its chords and its length, where you changed them
  const fe = {}, put = (sc, f, v) => { (fe[sc.id] || (fe[sc.id] = {}))[f] = v; };
  live.forEach((sc) => {
    const b = BASE.form.sections.find((x) => x.id === srcOf(sc.id));
    if (!b) return;
    for (const f of ["intro", "outro"]) if ((sc[f] || null) !== (b[f] || null)) put(sc, f, sc[f] || null);
    if (!same(sc.prog || null, b.prog || null)) put(sc, "prog", sc.prog || null);
    if (sc.bars !== b.bars) put(sc, "bars", sc.bars);
  });
  if (Object.keys(fe).length) st.f = fe;
  // and the key, the mode and the scale
  const A = DOC.alphabet || {}, B = BASE.alphabet || {};
  const al = {};
  for (const k of ["key", "mode", "scale"]) if ((A[k] ?? null) !== (B[k] ?? null)) al[k] = A[k] ?? null;
  if ((A.harmony ?? null) !== (B.harmony ?? null)) al.harmony = A.harmony ?? null;
  if (Object.keys(al).length) st.a = al;
  if (MINE >= 0) st.p = MINE;
  if (TEST) st.x = 1;
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
/* THE TEST SONG (Paul, 2026-11-02: "an incredibly easy little song that we can
   use to test what's playing when — one or two notes per phrase max").
   lilguys.html#test. The `pop` genre (a plain form, all four members) with every phrase replaced by one or
   two notes, each member on its OWN beat of the bar, so the ear can say who
   played and the eye can check the playhead against it:
       drums  a kick on beat 1 of each bar      bass  beat 2
       keys   beat 3                            lead  beat 4
   No groove, no swing, no developments, the bass's style off (a style can own
   the rhythm), 96 BPM. It rides as an edit (`x: 1`), applied first, so a link
   to it — edits and all — rebuilds it exactly. */
let TEST = false;
function testify(doc) {
  const steps = 32, z = () => new Array(steps).fill(0);
  const line = (deg, at, len) => {
    const c = { kind: "line", deg: z(), play: new Array(steps).fill("r"), vel: new Array(steps).fill(6), acc: z() };
    for (let i = at; i < at + len; i++) { c.play[i] = i === at ? "n" : "h"; c.deg[i] = deg; }
    return c;
  };
  const kick = z(); kick[0] = 1; kick[16] = 1;
  doc.material.cells["t.beat"] = { kind: "drum", lanes: { k: kick } };
  doc.material.cells["t.bass"] = line(0, 4, 4);
  doc.material.cells["t.keys"] = line(4, 8, 4);
  doc.material.cells["t.lead"] = line(7, 12, 4);
  doc.time.groove = null; doc.time.swing = null; doc.time.bpm = 96;
  const lines = doc.voices.filter((v) => v.kind === "line");
  for (const v of doc.voices) {
    v.material = v.kind === "drums" ? "t.beat" : v.kind === "bass" ? "t.bass" : v === lines[0] ? "t.keys" : "t.lead";
    if (v.kind === "bass" && v.cast) v.cast = { ...v.cast, style: null };
    // a pad plays held chords on the downbeat whatever its phrase says: the keys play theirs as a riff
    if (v === lines[0] && v.cast) v.cast = { ...v.cast, part: "riff" };
    v.development = {};
    for (const sc of doc.form.sections) v.development[sc.id] = v.kind === "line" ? "as written" : "";
  }
}

function applyEdits(doc, e) {
  if (!e || typeof e !== "object") return -1;
  if (e.x === 1) testify(doc);
  // the structure: each id a copy of a generated section, in this order (the
  // words and phrases it carries come with it; the keys below may change them)
  if (Array.isArray(e.o)) {
    const secs = doc.form.sections, by = new Map(secs.map((x) => [x.id, x])), out = [], seen = new Set();
    for (const it of e.o.slice(0, 40)) {
      if (!Array.isArray(it) || typeof it[0] !== "string" || !/^s\d{1,3}$/.test(it[0]) || seen.has(it[0])) continue;
      const b = by.get(it[1]);
      if (!b) continue;
      seen.add(it[0]);
      out.push({ ...JSON.parse(JSON.stringify(b)), id: it[0] });
      if (it[0] !== it[1]) {
        SRC.set(it[0], it[1]);
        for (const v of doc.voices) {
          if (v.development && v.development[it[1]] != null) v.development[it[0]] = v.development[it[1]];
          if (v.material && typeof v.material === "object") { const n = NuDocument.materialAt(v, it[1]); if (n) v.material[it[0]] = n; }
        }
      }
    }
    if (out.length) {
      const gone = secs.filter((x) => !seen.has(x.id)).map((x) => x.id);
      secs.length = 0; secs.push(...out);
      for (const v of doc.voices) for (const id of gone) {
        if (v.development) delete v.development[id];
        if (v.material && typeof v.material === "object") delete v.material[id];
      }
    }
  }
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
  // an instrument from a link is one the menu would offer, and not a greyed one
  if (e.i && typeof e.i === "object")
    for (const [name, val] of Object.entries(e.i)) {
      const v = doc.voices.find((x) => x.name === name);
      const r = v && typeof val === "string" ? instrOptions(doc, v) : null;
      if (r && r.options.some((o) => o.value === val && !o.disabled)) window.NuAvail.SHEETS[sheetOf(v)].set(doc, { voice: name }, val);
    }
  // a part from a link: one the part menu offers
  if (e.k && typeof e.k === "object")
    for (const [name, part] of Object.entries(e.k)) {
      const v = doc.voices.find((x) => x.name === name);
      if (!v || v.kind !== "line" || typeof part !== "string") continue;
      try {
        const r = window.NuAvail.optionsFor(doc, { voice: name }, "cast.part", window.NuGates, INSTR_ENV);
        if (r.options.some((o) => o.value === part && !o.disabled)) window.NuAvail.SHEETS["cast.part"].set(doc, { voice: name }, part);
      } catch (err) { /* a part the menu will not say is no part */ }
    }
  // a strip from a link: mute, solo and a fader in range, nothing else
  if (e.d && typeof e.d === "object")
    for (const [name, d] of Object.entries(e.d)) {
      const v = doc.voices.find((x) => x.name === name);
      if (!v) continue;
      // laid over the voice's own strip (a genre's room, level and EQ stay)
      const o = { ...(v.desk || {}) };
      for (const k of ["mute", "solo"]) { if (d && d[k] === true) o[k] = true; else delete o[k]; }
      const f = d ? Math.round(+d.fader) : 0;
      if (Number.isFinite(f) && f) o.fader = Math.max(-24, Math.min(12, f)); else delete o.fader;
      if (Object.keys(o).length) v.desk = o; else delete v.desk;
    }
  // a section's way in and out: a word its own sheet offers, or none
  if (e.f && typeof e.f === "object")
    for (const [sid, fs] of Object.entries(e.f)) {
      const sc = doc.form.sections.find((x) => x.id === sid);
      if (!sc || !fs || typeof fs !== "object") continue;
      for (const f of ["intro", "outro"]) {
        if (!(f in fs)) continue;
        let ok = [];
        try { ok = window.NuAvail.SHEETS["form." + f].values().map((o) => o.value); } catch (err) { continue; }
        if (fs[f] == null || fs[f] === "") sc[f] = null;
        else if (typeof fs[f] === "string" && ok.includes(fs[f])) sc[f] = fs[f];
      }
      // a chart: a chord a bar, a degree and maybe a seventh
      if ("prog" in fs) {
        const p = fs.prog;
        if (p == null) delete sc.prog;
        else {
          const one = (c) => c && !Array.isArray(c) && Number.isInteger(c.d) && c.d >= -12 && c.d <= 12 && (c.q == null || (typeof c.q === "string" && /^[a-z0-9#]{1,8}$/i.test(c.q)));
          const cl = (c) => ({ d: c.d, ...(c.q ? { q: c.q } : {}) });
          if (Array.isArray(p) && p.length && p.length <= 28 && p.every((b) => one(b) || (Array.isArray(b) && b.length && b.length <= 8 && b.every(one))))
            sc.prog = p.map((b) => (Array.isArray(b) ? b.map(cl) : cl(b)));
        }
      }
      if (Number.isInteger(fs.bars) && fs.bars >= 1 && fs.bars <= 16) sc.bars = fs.bars;
    }
  // a section's transformations: words the voice's own development menu offers, nothing else
  if (e.v && typeof e.v === "object")
    for (const [name, secs] of Object.entries(e.v)) {
      const v = doc.voices.find((x) => x.name === name);
      if (!v || !secs || typeof secs !== "object") continue;
      const sheet = v.kind === "drums" ? "dev.kit" : v.kind === "bass" ? "dev.bass" : "dev.line";
      let ok = null;
      try { ok = new Set(window.NuAvail.optionsFor(doc, { voice: name, section: doc.form.sections[0].id }, sheet, window.NuGates, INSTR_ENV).options.map((o) => o.value)); } catch (err) { continue; }
      for (const [sid, w] of Object.entries(secs)) {
        if (!doc.form.sections.some((sc) => sc.id === sid) || typeof w !== "string") continue;
        const words = chainOf(w).filter((x) => ok.has(x) || x === "as written");
        if (!v.development) v.development = {};
        v.development[sid] = (v.kind === "bass" ? words.slice(-1) : words).join(CHAINSEP) || (v.kind === "line" ? "as written" : "");
      }
    }
  // the alphabet: a value its menu offers
  if (e.a && typeof e.a === "object")
    for (const [k, sheet] of TONAL) {
      if (!(k in e.a)) continue;
      try {
        const opts = window.NuAvail.optionsFor(doc, {}, sheet, window.NuGates, INSTR_ENV).options;
        const val = e.a[k] == null ? "" : String(e.a[k]);
        if (opts.some((o) => String(o.value) === val && !o.disabled)) window.NuAvail.SHEETS[sheet].set(doc, {}, val);
      } catch (err) { /* a menu that will not answer keeps the genre's own */ }
    }
  if (e.a && (e.a.harmony === "cycle" || e.a.harmony === null)) { if (e.a.harmony) doc.alphabet.harmony = "cycle"; }
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
const editsOf = (st) => { const e = {}; for (const k of ["x", "o", "t", "c", "m", "i", "k", "d", "v", "f", "a", "p"]) if (st[k] != null) e[k] = st[k]; return e; };
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
  if (/^#test\b/.test(location.hash)) return { g: "pop", s: 1, e: { x: 1 }, bad: false };
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
  $("tempoOut").textContent = `${v}`;
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
  twoPhrases(DOC);
  BASE = JSON.parse(JSON.stringify(DOC));        // what the edits are measured against
  GENRE_BPM = DOC.time.bpm;
  TEST = !!(edits && edits.x === 1);
  SRC.clear();
  const mine = edits ? applyEdits(DOC, edits) : -1;
  MINE = -1;
  setLoopOnly(null); $("loopSec").checked = false;
  setTempo(DOC.time.bpm, true);
  push(true);
  if (mine >= 0 && members[mine]) setMine(mine, true, true);
  $("genre").value = titleOf(gk);
  fillTonal();
  HEAR = null; OFFW.clear();
  for (const b of BANK) b.length = 0;
  FOCUS = -1;
  document.title = `${titleOf(gk)} — Stellate Lilguys`;
  buildBand();
  select(-1);
  if (READ) { PART = firstPart(PART); applyReadPart(); }
  lastSec = -2;
  say("");
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
    if (p) applyGates();
    if (READ) { paintRail(); holdScreen(true); }
    $("play").innerHTML = icon(p ? "square" : "play");
    $("play").setAttribute("aria-pressed", String(!!p));
    $("play").setAttribute("aria-label", p ? "stop" : "play");
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
  $("closeDrawer").innerHTML = icon("x");
  $("tDraw").innerHTML = icon("pencil"); $("tSplit").innerHTML = icon("scissors");
  $("tClear").innerHTML = icon("eraser");
  // the header, in icons
  $("play").innerHTML = icon("play"); $("dice").innerHTML = icon("dices"); $("tempoBack").innerHTML = icon("rotate-ccw");
  $("share").innerHTML = icon("share-2"); $("readBtn").innerHTML = icon("book-open"); $("loopIcon").innerHTML = icon("repeat");
  $("volIcon").innerHTML = icon("volume-1"); $("mineIcon").innerHTML = icon("keyboard");
  const PI = { mono: "minus", stab: "layers", pad: "rectangle-horizontal" };
  $("tPoly").querySelectorAll("[data-p]").forEach((b) => { b.innerHTML = icon(PI[b.dataset.p]); });
  $("instr").addEventListener("change", (e) => { if (SEL >= 0) setInstr(SEL, e.target.value); });
  let volT = 0;
  $("vol").addEventListener("input", (e) => { clearTimeout(volT); const v = +e.target.value; volT = setTimeout(() => { if (SEL >= 0) setDesk(SEL, "fader", v); }, 180); });
  $("vol").addEventListener("dblclick", () => { $("vol").value = 0; if (SEL >= 0) setDesk(SEL, "fader", 0); });
  $("tClear").addEventListener("click", () => { if (SEL >= 0 && roll.notes.length) roll.clearAll(); });
  const tool = (t) => { roll.setTool(t); $("tDraw").setAttribute("aria-checked", String(t === "draw")); $("tSplit").setAttribute("aria-checked", String(t === "split")); };
  $("tDraw").addEventListener("click", () => tool("draw"));
  $("tSplit").addEventListener("click", () => tool("split"));
  window.__tool = tool;
  $("tPoly").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b && SEL >= 0) setPoly(SEL, b.dataset.p); });
  // THE GRID: a tap puts in a note this long (in steps; a step is a sixteenth),
  // remembered on this browser
  const GRIDS = [[1, "1/16"], [2, "1/8"], [4, "1/4"], [8, "1/2"]];
  let g0 = 1;
  try { g0 = +localStorage.getItem("lilguys.grid") || 1; } catch (e) {}
  const grid = (n) => {
    roll.setSnap(n);
    [...$("tGrid").children].forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.g === n)));
    try { localStorage.setItem("lilguys.grid", String(n)); } catch (e) {}
  };
  $("tGrid").innerHTML = GRIDS.map(([n, l]) => `<button role="radio" data-g="${n}" aria-checked="false" title="${l} notes: a tap puts one in, a drag draws them, moves and stretches land on the ${l} grid (G steps through them)">${l}</button>`).join("");
  $("tGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) grid(+b.dataset.g); });
  grid(GRIDS.some((x) => x[0] === g0) ? g0 : 1);
  window.__grid = () => { const i = GRIDS.findIndex((x) => x[0] === roll.snap); grid(GRIDS[(i + 1) % GRIDS.length][0]); };
  $("zJump").addEventListener("click", () => { if (HEAR && HEAR.sec != null) { if (loopOnly != null) { setLoopOnly(HEAR.sec); push(false); } startAt(HEAR.sec); } });
  document.addEventListener("pointerdown", (e) => { if (!$("wordMenu").hidden && !e.target.closest("#wordMenu, .tw.add, .ch, .pl")) $("wordMenu").hidden = true; });
  for (const [id, sheet] of TONAL) $(id).addEventListener("change", (e) => setTonal(sheet, e.target.value));
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
  // the keyboard: space plays, 1-4 open a member, ← → flip through them
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, select, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); $("play").click(); }
    else if (/^Digit[1-4]$/.test(e.code)) { if (READ) { PART = firstPart(+e.code.slice(5) - 1); applyReadPart(); } else select(+e.code.slice(5) - 1); }
    else if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && !READ) { e.preventDefault(); flip(e.code === "ArrowRight" ? 1 : -1); }
    else if (e.code === "Escape") { if (!$("wordMenu").hidden) $("wordMenu").hidden = true; else if (READ) exitRead(); else select(-1); }
    else if (e.code === "KeyD" && SEL >= 0 && !READ) window.__tool("draw");
    else if (e.code === "KeyG" && SEL >= 0 && !READ) window.__grid();
    else if (e.code === "KeyS" && SEL >= 0 && !READ) window.__tool("split");
    else if (e.code === "KeyR") READ ? exitRead() : enterRead();
  });
  if (window.ResizeObserver) { let rT = 0; new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(drawLanes, 120); }).observe($("song")); }
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
  members: () => members, plan, wantGates, engineDoc, setDesk, cutOf,
  gateable: (m) => GATEABLE.has(m), unitsOf: (m) => [...UNITS_OF].filter(([, ms]) => ms.has(m)).map(([k]) => k), roll: () => roll, staff: () => staff, cellNotes, cellsOf,
  check, push, resetPrefs, hear, get judge() { return judge; },
  listenForTest: () => { LISTEN = true; makeJudge(); }, songState, applyEdits, pack, unpack, linkOf, trimBand, twoPhrases, loadGenre, select, setMine, setTempo, enterRead, exitRead, songBeatNow, beatNow, getPosition, prefs,
};
boot().catch((e) => { console.error(e); say("could not start: " + (e && e.message || e)); });
