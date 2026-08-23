// nukernel/ui/band.js — THE BAND: an arranger and two players. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const Band = window.NuBand;
const { catalog: catalog0, say: say0, says: says0, toSong: toSong0, seatDecisions,
        nextAsk, nextAnywhere, answer, SEATS, sectionAsks, setSection } = Band;
// THE PRODUCER IS ONE SEAM, AND THIS IS IT. nukernel/producer.js is a pure
// data-tier module like every other file below the UI — it reads the record
// band-kit already composed and moves it, and it is the only thing in the
// building that knows what "make the drums punk" means. Nothing in
// band-kit.js, kernel.js or genres.js was touched to give it a home: the
// section genres toSong hands back ARE the seam.
//
// One run per model, cached on the model's own identity (the model is
// immutable and replaced on every answer, so a WeakMap keyed on it is an
// exact cache). With no notes the run returns the sections it was handed,
// unchanged and by reference — which is what makes a record with no
// producer notes byte-identical to the record before the producer existed.
const Prod = window.NuProducer;
const PRODUCED = new WeakMap();
function produced(m) {
  let r = PRODUCED.get(m);
  if (!r) { const base = toSong0(m, MODES);
            r = Prod.run(m, base); r.base = base; PRODUCED.set(m, r); }
  return r;
}
const toSong = (m, MODES_, only) =>
  (only == null ? produced(m).secs : toSong0(m, MODES_, only));
// WHICH THEME THE PAGE IS EDITING. Two themes at most — the tune (A) and
// its answer (B) — and every arranger tray word, bar cell and staff caption
// aims at the one in hand. Nothing but this page cares: band-kit's say/says/
// catalog take the theme as a fourth argument and default to A, so a page
// (or a gate) that never mentions themeEdit is byte-identical.
let themeEdit = "a";
const themeNow = () => (themeEdit === "b" && model.ideaB && model.ideaB.on ? "b" : "a");
const catalog = (m, who) => catalog0(m, who, who === "arranger" ? themeNow() : undefined);
const say = (m, who, id) => say0(m, who, id, who === "arranger" ? themeNow() : undefined);
const says = (m, who, id) => says0(m, who, id, who === "arranger" ? themeNow() : undefined);
import { GENRES, NuSong, MODES } from "./deps.js";
import { adoptSong, SONG, SLOTS, putPhrase, on, commit, setBpm, setSwing, setMeter, setPoolChair,
         setMixOffset, clearMixOffsets, vol, setVol } from "./state.js";
import { startAt, stop, playing, warmup, getPosition, passAt,
         announceChange } from "../audio/live.js";
import { registerSW, warmCache, warmShell, warmed } from "../audio/offline.js";
// the COMPILED score — the same per-bar artifact the engine is fed. The staff
// reads it to re-engrave a sounding section as played (playedPhrase, below);
// nothing here computes a note of its own.
import { timeline } from "../audio/plan.js";
import { toEngraving, toNotes } from "./abc.js";
import { playAudition, stopAudition, auditioning, zoneFilesFor } from "../audio/audition.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const GKP = "lab.band.";           // one session genre per section of the form
const MELP = "lab.idea.";          // ...and the melody's own, when somebody takes it
const VOXP = "lab.voice.";         // ...and the singer's, which is a layer too
let cells = [];                    // the pattern's cells, for the playhead
let asking = null;                 // a decision being revisited, if any
// THE ROOM OPENS WITH A RECORD IN IT (2026-08-22, Paul: "The start again
// 'default' song should play and interpret the theme and its answer across
// a verse-chorus structure"). `Band.blank()` is still the empty room — the
// dice rolls from it and every gate measures from it — and `Band.opening()`
// is that room with the demonstration record already standing: verse,
// chorus, verse, chorus, the tune in the verses, the answer in the choruses
// and the last one back up a step. Nothing in it is answered, so the first
// question is still "when is it?" and every part of it is overridden by the
// first word anybody says.
let model = Band.opening();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes
let seat = "arranger";             // who you are talking to
let ledger = [];                   // what has been said, in order
let section = null;                // a section being arranged, if any
let adding = false;                // "add a box" open, asking what kind
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
  // ...AND THE TEMPO IS THE PRODUCER'S TOO, within a fence. A tempo is too
  // strong a lever to hand a lerp — one press toward punk from 96 is +25.6
  // bpm, a whole catalog standard deviation, from one word about the drums
  // — so producer.js caps the move at 8% of the standing tempo per press.
  // With no notes this IS model.song.bpm, to the byte.
  setBpm(produced(model).bpm);
  setSwing(model.song.swing || null);
  // ...and how the record counts, the third song fact of the family. The
  // ENGINE reads the meter off each section's genre (band-kit stamps it);
  // this is the SONG's record of the same fact, which is what a saved
  // document round-trips and what song.js validates.
  setMeter(model.song.meter || null);
  setPoolChair("bass", model.bass.instr);
  // the keys player sits in whichever chair their JOB names — the pool casts
  // by role, which is exactly what a part is
  // the pool casts by ROLE, and two chairs can want the same role — a jazz
  // date comps on the keys AND the guitar, both `stab`, and a role key can
  // only name one instrument. So the pool is NOT how this page's two pitched
  // voices resolve any more: the genre's `chairs` seam carries each chair's
  // own instrument per voice and derive.js poolInstrOf reads it first. The
  // row written here is the roster surface (and any reader without the
  // seam); where two chairs collide on one role, the one whose part it
  // actually is wins the label, and the guitar's roles are its own
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
  // ...AND THE PRODUCER'S HAND LANDS ON THE SAME BOARD, added rather than
  // applied over: two answers on one channel ADD, the way two hands on a
  // board would, which is exactly what audio/desk.js already does with a
  // channel's several treatments. So the producer cannot fight the engineer
  // on the desk — addition commutes — and it cannot fight the hand on a
  // kernel field either, because producer.js never moves a field the hand
  // has answered by name (its `held` set is the band's annotated knobs).
  clearMixOffsets();
  const desk = Band.mixOf(model), pmix = produced(model).mix;
  for (const chan of new Set([...Object.keys(desk), ...Object.keys(pmix)])) {
    const a = desk[chan] || {}, b = pmix[chan] || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "eq") {
        const e = {};
        for (const band of ["lo", "mid", "hi"]) {
          const v = +(((a.eq || {})[band] || 0) + ((b.eq || {})[band] || 0)).toFixed(2);
          if (v) e[band] = v;
        }
        setMixOffset(chan, "eq", e);
      } else if (k === "mute") setMixOffset(chan, "mute", !!(a.mute || b.mute));
      else setMixOffset(chan, k, +(((a[k] || 0) + (b[k] || 0)).toFixed(3)));
    }
  }
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
  // record plays with the network off — the piano-audition zones for the
  // theme's own span included, so "hear it on the piano" works on a train.
  let extra = [];
  try {
    if (model.idea && model.idea.on) {
      const t = toNotes(Band.Id.toPhrase(model.idea), themeOpts(model, "a"));
      extra = zoneFilesFor(t.notes.map((x) => x.midi));
      // ...and the answer's own span, when there is one — a warmed record
      // plays BOTH its themes on the train
      if (model.ideaB && model.ideaB.on) {
        const t2 = toNotes(Band.Id.toPhrase(model.ideaB), themeOpts(model, "b"));
        extra = [...extra, ...zoneFilesFor(t2.notes.map((x) => x.midi))];
      }
    }
  } catch (e) {}
  warmCache(extra);
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
  announceChange(module_ === "ideas"
    ? (themeNow() === "b" ? "the answer" : "the tune") : seatWord(who), si);
}

/* ---------- the theme, written down ---------- */
// PLAN Phase 2: a theme RENDERS AS SHEET MUSIC. ui/abc.js compiles the
// phrase the room owns into an ABC string with the kernel's own pitch math,
// and the vendored abcjs (vendor/abcjs/ — MIT, see NOTICE) engraves the SVG.
// THE STAFF FOLLOWS THE THEME, NOT THE ARRANGEMENT (2026-08-21). It used to
// draw only while some section's TAKERS chair carried the tune — so a form
// change (a vamp, an AABA, a blues: no default taker) or a section answered
// "nobody takes it" took the sheet music off the page, and nothing in the
// THEMES area, where the theme is actually edited, could bring it back:
// "keeps disappearing when I change things and never comes back". The law
// now: whenever the record HAS a written theme (m.idea.on — every counted-in
// record does), the staff is on the page; whether anybody plays it is the
// arrangement's business, not the notation's.
let staffLib = null;    // one promise for the vendor chunk — first need only
const staffHost = {};   // per theme: the <div> the SVG lives in, KEPT across draws
const staffAbc = {};    // per theme: the ABC the CURRENT draw wants engraved
const staffDone = {};   // ...and the ABC actually IN the host's SVG. The old
                        // guard compared against what was last ASKED for, so
                        // an engrave that failed or was skipped (a load
                        // error, a host that missed its window) was never
                        // retried while the music stayed the same; keyed on
                        // what is actually on screen, every draw re-engraves
                        // until the SVG stands. Keyed "a"/"b" since the
                        // answer theme earned a staff of its own.
const staffGlyphs = {}; // per theme: glyph -> toNotes note index (abc.js
                        // toEngraving — tied pieces share their note's index)
const staffEng = {};    // ...and the whole engraving that is ON the staff, so
                        // a gate can ask the ARTIFACT which octave it is in
                        // and whether the lit glyph is the sounding note
const staffCue = {};    // per theme: the caption line UNDER the staff — the
                        // one place the page says whether you are looking at
                        // the theme as written or as this section plays it
// AS PLAYED (2026-08-21, Paul: "can you visually rewrite the themes for their
// actual notes as you play them"). The written staff is the composer's
// reference view; a section plays the theme TRANSFORMED (per.back: up a step,
// augmented, just its head), in the record's key, over that section's own
// changes and conformed by the harmony — so the page and the air were showing
// two different tunes. While the record plays, the sounding section's theme is
// re-engraved from the notes the ENGINE WAS HANDED, and the lights ride that
// engraving, because the glyph map comes out of the same call.
let playedEng = {};     // per theme: the as-played engraving standing in
let playedSi = null;    // ...and the section it was read off
let staffSig = "";      // the notes+caption currently on the staves — the churn
                        // guard, so a beat that changes nothing engraves nothing

// THE SOUNDING NOTE, LIT ON THE STAFF (2026-08-21, Paul: "can you light up
// notes in the theme when playing them"). One note index per theme is ever
// lit; lighting is a class swap on the already-engraved glyphs (every glyph
// of a tied note lights together, because the map says they are one note)
// and nothing is touched unless the index CHANGED — no per-frame churn, no
// re-engrave. Who calls it: the band's own beat feed (lightBeat, on "pos"
// below) while the record plays, and the piano audition's note timers while
// the piano has the floor.
let litT = null, litIdx = null, litEls = [];
function lightStaff(t, idx) {
  if (idx == null || idx < 0) { t = null; idx = null; }
  if (litT === t && litIdx === idx) return;
  for (const e of litEls) e.classList.remove("dlit");
  litEls = []; litT = t; litIdx = idx;
  if (t == null) return;
  const host = staffHost[t], map = staffGlyphs[t];
  if (!host || !map) return;
  const els = host.querySelectorAll(".abcjs-note");
  for (let g = 0; g < map.length && g < els.length; g++)
    if (map[g] === idx) { els[g].classList.add("dlit"); litEls.push(els[g]); }
}

// THE LAZY CHUNK, and why it is a <script> element rather than import():
// the vendor build is a classic UMD whose wrapper hands `this` to the
// factory, and module scope makes `this` undefined — measured in chromium,
// import() of this file parses all 500 KB and then throws "Cannot set
// properties of undefined" before ABCJS exists. A script element runs it as
// the classic script it is: the same URL, one fetch, same-origin and
// service-worker cacheable (audio/offline.js warms it with the record, so a
// warmed record draws its staff with the wire cut), and nothing on the boot
// path — the element is not made until a staff is actually asked for.
function loadStaffLib() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (!staffLib) staffLib = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/abcjs/abcjs-basic-min.js", import.meta.url).href;
    s.async = true;
    s.onload = () => resolve(window.ABCJS);
    s.onerror = () => { staffLib = null; s.remove();
      reject(new Error("abcjs did not arrive")); };
    document.head.append(s);
  });
  return staffLib;
}

// THE STAFF MUST NOT DISAGREE WITH THE SOUND: key, mode and register are
// the same three facts band-kit toGenre hands the kernel (B.KEYS by the
// key answer, dorian/ionian by the minor answer, Id.regOf), and the phrase
// is Id.toPhrase(m.idea) — the theme as the room owns it, before any
// section's chords transpose its bars. One table, read by the ABC compiler
// AND the piano audition, so the two can never disagree either.
const themeOf = (m, t) => (t === "b" ? m.ideaB : m.idea);
const themeOpts = (m, t) => ({
  key: Band.B.KEYS[m.song.key] || 0,
  // the arranger's colour answer included (band-kit modeKeyOf: unanswered,
  // minor is still dorian and major still ionian) — the staff and the
  // audition must not disagree with what toGenre hands the kernel
  mode: MODES[Band.modeKeyOf(m.song)],
  reg: Band.Id.regOf(themeOf(m, t) || m.idea),
  bpm: m.song.bpm,
  // HOW THIS BAR COUNTS — declared, not derived: twelve steps reduce to 3/4
  // and only 3/4, and a 6/8 record is the same twelve steps heard in two
  // (ui/abc.js meterOf says why). Absent = the 4/4 every staff drew before.
  ...(Band.metOf(m.song)
      ? { stepsPerBar: Band.metOf(m.song).steps, abc: Band.metOf(m.song).abc,
          beam: Band.metOf(m.song).beam } : {}),
  // the LEAD part's own cap (kernel PARTS.lead maxHold), so the staff and
  // the piano say what the band will actually play — the staff used to show
  // a gap as a note held straight across it while the engine made the rest
  // real at a beat. An explicit hold (the tie mark, a sentence's carry)
  // outranks this in toNotes exactly as it does in the kernel, so the ties
  // still draw at full length.
  maxHold: 4,
});

/* ---------- THE STAFF SHOWS WHAT IS ACTUALLY BEING PLAYED --------------
   The written staff is the theme as the ROOM owns it, which is the right
   thing to edit against and the wrong thing to watch. A section plays it
   TRANSFORMED (per.back — up a step, augmented, just its head), in the
   record's key, over that section's own changes, conformed by the harmony
   stage; "up a step" moved nothing on the page and `aug` drew no longer
   notes. So while the record plays, the sounding section's theme is
   re-engraved FROM THE COMPILED SCORE.

   THE ARTIFACT, NEVER A RE-COMPUTATION (CLAUDE.md's test-the-artifact law):
   audio/plan.js timeline() is the per-bar event list the engine itself is
   fed, layer-tagged and register-homed. This reads ONE CYCLE of the melody
   layer off it — the theme's own bars, which is the length the layer cycles
   on (band-kit per16) — and hands abc.js absolute MIDI, so key, register,
   transposition and the harmony's conforming are all already in the number.
   The lights ride the same call's glyph map, so the lit index stays true. */
const playedOpts = (m) => ({
  // key and mode here choose the SIGNATURE only — every pitch arrives as an
  // absolute MIDI number, so nothing about the sound is re-derived
  key: Band.B.KEYS[m.song.key] || 0,
  mode: MODES[Band.modeKeyOf(m.song)],
  bpm: m.song.bpm,
  ...(Band.metOf(m.song)
      ? { stepsPerBar: Band.metOf(m.song).steps, abc: Band.metOf(m.song).abc,
          beam: Band.metOf(m.song).beam } : {}),
});
function playedPhrase(si) {
  const TL = timeline();
  if (!TL.length || si == null || si < 0) return null;
  const lay = MELP + si, sec = SONG[si];
  if (!sec || !GENRES[lay]) return null;
  const ent = (sec.stack || []).find((e) => e.g === lay);
  const ph = ent && SLOTS[ent.slots[0]];
  if (!ph || !ph.gate || !ph.gate.length) return null;
  // THE BAR IS THE RECORD'S. This rounded the played staff onto a sixteen-slot
  // bar while already knowing (bar.steps) that the bar was twelve — a wrongly
  // lit staff still lights, which is why it is worth being exact about.
  const NB = stepsNow();
  const cyc = Math.max(1, Math.round(ph.gate.length / NB));   // the theme's own bars
  const n = cyc * NB;
  const gate = new Array(n).fill(0), midi = new Array(n).fill(0),
        hold = new Array(n).fill(0);
  let any = false;
  for (const bar of TL) {
    const bi = bar.barIn || 0;
    if (bar.si !== si || bi >= cyc) continue;
    // the NOMINAL grid (bar.steps), because `off` was written on it: the
    // tempo map warps barSteps afterwards and a staff has no rubato
    const rate = NB / (bar.steps || NB);
    for (const e of bar.ev) {
      if (e.layer !== lay || e.kind !== "line" || e.n == null) continue;
      const at = bi * NB + Math.max(0, Math.min(NB - 1, Math.round((e.off || 0) * rate)));
      // a groove push, an ornament's grace note: two events can share one
      // sixteenth and a staff has one place for them. The first stands.
      if (gate[at]) continue;
      gate[at] = 1; any = true;
      midi[at] = Math.round(e.n + (e.home || 0));
      hold[at] = Math.max(1, Math.round((e.dur || 0) * rate));
    }
  }
  return any ? { gate, midi, hold } : null;
}

// the caption, in the house voice — words, no icons
const backWord = (k) => ((Band.Id.TRANSFORMS || {})[k || "same"] || {}).w || "";
const cueWord = {};     // per theme: the words, kept so a redraw repaints them
// ...and THE OCTAVE, said out loud (2026-08-22). A staff that has been moved
// under 8va/8vb reads correctly only if you know the marking, and the page's
// own idiom is words: the caption carries the clause, so a reader who has
// never seen the little 8 on the clef still learns that the tune sounds an
// octave away from where it is drawn. It is written by ENGRAVEINTO, off the
// engraving that actually went onto the staff — never re-derived here, so the
// words and the notes on screen cannot come from two different decisions.
const cueOtt = {};      // per theme: the octave clause, from what is on screen
const paintCue = (t) => { if (staffCue[t]) staffCue[t].textContent =
  [cueWord[t], cueOtt[t]].filter(Boolean).join(" — "); };
function setCue(t, words) { cueWord[t] = words || ""; paintCue(t); }
// abc.js hands back `ottava` (+1 = 8va, sounds an octave above the staff;
// -1 = 8vb, below) and `wide` (no octave rescues this one — the ledger lines
// stand, and the page says so rather than implying the marking fixed it)
function ottWords(eng) {
  const parts = [];
  if (eng && eng.ottava > 0) parts.push("8va — it sounds an octave above the staff");
  else if (eng && eng.ottava < 0) parts.push("8vb — it sounds an octave below the staff");
  if (eng && eng.wide) parts.push("it runs wider than one staff, so the ledger lines stand");
  return parts.join("; ");
}
// DRESS BOTH STAVES. `si`/`t` name the sounding section and the theme it
// carries (null when the record is stopped); `cue` is what the page says
// about it. Guarded on a signature of the notes AND the words, so a beat
// that changes neither engraves nothing — the low-churn law.
function dressStaff(si, t, cue, elseCue) {
  const pp = t ? playedPhrase(si) : null;
  const sig = (pp ? si + "|" + t + "|" + pp.gate.join("") + "|" + pp.midi.join(",") +
               "|" + pp.hold.join(",") : "") +
              "\u00a7" + (cue || "") + "\u00a7" + (elseCue || "");
  if (sig === staffSig) return playedEng[t] || null;
  staffSig = sig;
  playedEng = {}; playedSi = pp ? si : null;
  if (pp) playedEng[t] = toEngraving(pp, playedOpts(model));
  for (const k of ["a", "b"]) {
    // the words are remembered whether or not the staff is on the page yet
    // (themeFig repaints them), the engraving needs a host to stand in
    setCue(k, k === t ? cue : elseCue);
    const theme = themeOf(model, k);
    if (!staffHost[k] || !theme || !theme.on) continue;
    engraveInto(k, playedEng[k] ||
      toEngraving(Band.Id.toPhrase(theme), themeOpts(model, k)));
  }
  return playedEng[t] || null;
}

// PUT AN ENGRAVING ON A STAFF. The one writer of staffAbc/staffGlyphs/
// staffDone, so the ABC on screen, the glyph map the lights read and the
// music the page thinks it is showing can never be three different things.
// Engraves whenever what is ON SCREEN is not this call's music — a changed
// theme re-engraves, and so does a host whose last engrave failed, was
// skipped, or lost its SVG: an error retries on the very next call.
function engraveInto(t, eng) {
  const abc = eng.abc;
  staffAbc[t] = abc;
  staffGlyphs[t] = eng.glyphs;     // glyph -> note map, for the highlight
  staffEng[t] = eng;               // what is on the staff, whole
  cueOtt[t] = ottWords(eng);       // ...and the octave clause of the caption
  paintCue(t);
  const host = staffHost[t];
  if (!host) return;
  if (abc === staffDone[t] && host.querySelector("svg")) return;
  loadStaffLib().then((A) => {
    // a draw may have moved on while the chunk was on the wire — engrave
    // only what is still current, where it still stands
    if (!A || host !== staffHost[t] || abc !== staffAbc[t] || !host.isConnected) return;
    try {
      // add_classes makes every engraved note addressable (.abcjs-note in
      // engraving = timeline order; rests class .abcjs-rest, disjoint) —
      // the highlight below rides those classes
      A.renderAbc(host, abc, { responsive: "resize", add_classes: true });
      staffDone[t] = host.querySelector("svg") ? abc : "";
      // a re-engrave replaced the SVG under a lit note: light it again
      if (litT === t && litIdx != null) { const i = litIdx; litIdx = null; lightStaff(t, i); }
    } catch (e) { staffDone[t] = ""; }
  }).catch(() => { staffDone[t] = ""; });  // a failed load retries next call
}

// one theme's figure: the staff, its name, and its own piano button
function themeFig(m, t) {
  const theme = themeOf(m, t);
  // the AS-PLAYED engraving outranks the written one while a section that
  // carries this theme is sounding (dressStaff, below); a redraw mid-record
  // must not put the written notes back under the lights
  const eng = playedEng[t] || toEngraving(Band.Id.toPhrase(theme), themeOpts(m, t));
  // a plain bordered box with the theme's name — the name the RECORD gives
  // it (themeName: a hook when the singer carries it, a riff when the
  // guitar does; the answer is called the answer), the same word the
  // outline's node is titled by. With a B theme in the room the caption is
  // a BUTTON: tapping a theme's name puts that theme in the editing hand —
  // the staff you tapped is the one the questions and the bar are about.
  const fig = el("figure", "dstaff" + (m.ideaB && m.ideaB.on && themeNow() === t ? " on" : ""));
  const name = Band.themeName(m, t === "b" ? "b" : undefined);
  if (m.ideaB && m.ideaB.on) {
    const cap = el("figcaption");
    const b = el("button", "dthemepick" + (themeNow() === t ? " on" : ""), name);
    b.type = "button";
    b.dataset.k = "theme|" + t;
    b.addEventListener("click", () => {
      themeEdit = t; module_ = "ideas"; section = null; asking = null; draw(); });
    cap.append(b);
    fig.append(cap);
  } else fig.append(el("figcaption", null, name));
  if (!staffHost[t]) { staffHost[t] = el("div", "dstaffsvg"); staffDone[t] = ""; }
  fig.append(staffHost[t]);        // the same node every draw: no async flash
  if (!staffCue[t]) staffCue[t] = el("p", "dstaffcue");
  paintCue(t);                     // the words AND the octave clause
  fig.append(staffCue[t]);         // ...and the same caption node, likewise
  engraveInto(t, eng);
  // HEAR IT ON THE PIANO — the theme alone, on the GM grand, through
  // audition.js's own little context: the click is the gesture, the band
  // engine is never touched, and if the band is playing the piano simply
  // plays over it (somebody at the piano in the same room). The button says
  // its own state in a word, like the transport.
  const hear = el("button", "dhear", auditioning() ? "stop" : "hear it on the piano");
  hear.type = "button";
  hear.dataset.k = t === "b" ? "hear|b" : "hear";
  hear.addEventListener("click", () => {
    if (auditioning()) stopAudition();
    else {
      // THE PIANO PLAYS THE THEME AS WRITTEN, so it takes the written staff
      // with it: its onNote indexes the written timeline, and lighting that
      // index on an as-played engraving would light the wrong note.
      dressStaff(null, null, "", "");
      const t2 = toNotes(Band.Id.toPhrase(themeOf(model, t)), themeOpts(model, t));
      // the piano lights the staff as it plays — the same toNotes timeline
      // the audition schedules from, so index i IS the sounding note
      playAudition({ notes: t2.notes, bpm: model.song.bpm,
                     onNote: (i) => lightStaff(t, i) }, () => {
        lightStaff(null, null);
        for (const b of document.querySelectorAll(".dhear"))
          b.textContent = "hear it on the piano";
      });
    }
    for (const b of document.querySelectorAll(".dhear"))
      b.textContent = auditioning() ? "stop" : "hear it on the piano";
  });
  fig.append(hear);
  return fig;
}

function themeStaff(m) {
  // NOTHING RENDERS WHEN THERE IS NO WRITTEN THEME — and the kept hosts are
  // dropped with it, so a theme that comes back is engraved fresh, never
  // shown stale. (A record that has been counted in always has one; this
  // guard is the empty room and a recalled pre-theme session.)
  if (!(m.idea && m.idea.on)) {
    delete staffHost.a; delete staffHost.b;
    delete staffGlyphs.a; delete staffGlyphs.b;
    delete staffEng.a; delete staffEng.b;
    delete staffCue.a; delete staffCue.b;
    staffAbc.a = staffAbc.b = ""; staffDone.a = staffDone.b = "";
    playedEng = {}; playedSi = null; staffSig = "";
    cueWord.a = cueWord.b = ""; cueOtt.a = cueOtt.b = "";
    lightStaff(null, null);
    if (auditioning()) stopAudition();
    return null;
  }
  const wrap = document.createDocumentFragment();
  wrap.append(themeFig(m, "a"));
  // ...and the answer beside it, when the arranger wrote one; a B taken
  // back out drops its host so a later one engraves fresh
  if (m.ideaB && m.ideaB.on) wrap.append(themeFig(m, "b"));
  else { delete staffHost.b; delete staffGlyphs.b; delete staffCue.b;
         delete staffEng.b;
         staffAbc.b = ""; staffDone.b = ""; cueOtt.b = ""; delete playedEng.b;
         staffSig = "";
         if (litT === "b") lightStaff(null, null); }
  return wrap;
}

// A THEME IS A NODE OF THE OUTLINE (PLAN.md THE THEME COMPOSER §1): its
// heading is the name the RECORD derives — the hook, the riff, the answer —
// never a letter. With two themes in the room the heading is a BUTTON, the
// same switch the staff captions carry: tapping a node puts that theme in
// the editing hand and ITS questions come to the floor, which is how both
// themes stand in the outline while only one set of questions is ever open
// (the one-question law counts every .dopt on the page).
function themeNodeHead(t, edited) {
  const name = Band.themeName(model, t === "b" ? "b" : undefined);
  if (!(model.ideaB && model.ideaB.on)) return document.createTextNode(name);
  const b = el("button", "dtnode" + (edited ? " on" : ""), name);
  b.type = "button";
  b.dataset.k = "themenode|" + t;
  b.addEventListener("click", () => {
    themeEdit = t; module_ = "ideas"; section = null; asking = null; draw(); });
  return b;
}

/* ---------- the sentence, measure by measure ---------- */
// PLAN.md THE THEME COMPOSER §3–4: a written-out sentence is 2–4 measures,
// EACH with its own derived cell, and the ties are first-class. This strip
// is the sentence made VISIBLE — one row per measure: sixteen places, a
// filled place where a note starts, a low dash where a note is still
// sounding THROUGH the place (an explicit hold: the hand's tie mark or the
// sentence's own carry/land, the only spans the kernel holds past the lead
// part's cap — so a dash crossing from one row's end into the next row's
// start IS the tie over the barline), and the measure's role in the
// sentence said beside it in the writer's own words. The word is a real
// BUTTON now (PLAN.md THE THROUGH-COMPOSED THEME): tapping a measure's row
// puts that bar in the editing hand and opens the count grid — one tap from
// "that bar is wrong" to editing it — and a WRITTEN bar says the honest
// state, "written by hand", in place of its retired role word. This is the
// "write this bar out?" question answered by DOING; no .dopt, so the gates'
// option counts and the one-question law never see it. A one-measure theme
// has no sentence and no strip — its one measure IS the count grid.
function sentStrip(theme) {
  if (!theme || !theme.on) return null;
  const bars = Band.Id.barsOf(theme);
  if (bars < 2) return null;
  const ph = Band.Id.toPhrase(theme);
  const NN = ph.gate.length, N16 = stepsNow();
  const state = new Array(NN).fill(0);        // 0 rest, 1 onset, 2 held through
  for (let i = 0; i < NN; i++) if (ph.gate[i]) {
    state[i] = 1;
    const hd = (ph.hold && ph.hold[i]) || 0;
    for (let j = i + 1; j < i + hd && j < NN; j++) state[j] = 2;
  }
  const rows = (Band.Id.SENTENCES[theme.sent || "plain"] || {}).rows;
  const rowOf = (rows && rows[bars]) || null;
  const wr = Band.Id.wroteOf(theme);
  // the role words are the writer's, not the table's keys
  const ROLEW = { state: "says it", restate: "again, ending differently",
                  develop: "pushes it further", land: "lands on one note",
                  carry: "picks it up mid-breath, tied over" };
  const wrap = tableOf("the sentence");
  for (let b = 0; b < bars; b++) {
    // PLAIN TEXT CELLS (the no-formatting reset): one measure per row,
    // sixteen characters — x a note starting, - the note still sounding
    // through (the tie made visible; a - opening the next row IS the tie
    // over the barline), · a rest — a space at each beat so the bar counts
    // itself. The measure's number is the row's own name.
    let txt = "";
    const CU = (metNow() || {}).count || 4;
    for (let i = 0; i < N16; i++) {
      const v = state[b * N16 + i];
      txt += v === 1 ? "x" : v === 2 ? "-" : "·";
      if (i % CU === CU - 1 && i < N16 - 1) txt += " ";
    }
    const word = wr[b] ? "written by hand"
      : rowOf ? (ROLEW[rowOf[b]] || rowOf[b]) : (b ? "the cell again" : "says it");
    const aim = el("button", "dsentrole", word);
    aim.type = "button";
    aim.dataset.k = "sbar|" + b;
    aim.addEventListener("click", () => {
      model = say(model, "arranger", "bar:" + b);
      module_ = "ideas"; section = null; asking = "grp:the bar";
      push(false); draw(); });
    const tr = el("tr");
    const th = el("th"); th.scope = "row"; th.append("bar " + (b + 1) + ":");
    const td = el("td", null, txt);
    const td2 = el("td");
    td2.append(aim);
    tr.append(th, td, td2);
    wrap.append(tr);
  }
  return wrap;
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
// ...and whether the FRONT DOOR is standing (below): true whenever no
// record has been called, which is what keeps the arranger's own sheet
// quiet and the staff unengraved until there is a record to engrave.
let doorShut = false;

// the heading-word of an area, as a button: tap "themes"/"song"/"band" and
// that area's next question comes to the floor
function modButton(word, key) {
  const b = el("button", "dmod" + (module_ === key ? " on" : ""), word);
  b.type = "button";
  b.dataset.k = "mod|" + key;
  b.addEventListener("click", () => {
    module_ = key; section = null; asking = null; picker = null;
    pverb = null; psubj = null; draw(); });
  return b;
}

// EVERYTHING IS A TABLE, AND NOTHING IS FOLDED (2026-08-23, Paul: "Can you
// just put everything into a table and make it all fully expanded and
// simple to scroll"). The <details>/<summary> folds and the labelled <nav>
// wrappers are both gone: a fold is a thing to tap before you can read, and
// a page whose point is that you can see the whole record should not have
// any. What is left is one long scroll of real tables — the gig sheet, the
// band, the song's boxes, the producer's notes, the front door's run — each
// with a <caption> saying what it is, which names the region for assistive
// tech the way the <nav>'s aria-label used to and costs no wrapper.
//
// ONE ROW = ONE FACT: the name in a <th scope="row"> (the control that
// re-asks it, then the colon law's real ":" text node), the value in the
// <td> beside it. That scope is what pairs the two for a screen reader —
// which is why no hidden word is needed to help it.
function tableOf(caption) {
  const t = el("table");
  if (caption) { const c = el("caption"); c.append(caption); t.append(c); }
  return t;
}
function trOf(head, value) {
  const tr = el("tr");
  const th = el("th");
  th.scope = "row";
  th.append(head, ":");
  tr.append(th, el("td", null, value == null ? "" : value));
  return tr;
}
// A QUESTION OPENS AT ITS OWN ROW — a following row of the same table
// spanning both columns, so the sheet expands in place (the question is
// under the name it belongs to) and the page simply grows downward.
function askRow(tr, node) {
  const r = el("tr");
  const td = el("td");
  td.colSpan = 2;
  td.append(node);
  r.append(td);
  tr.after(r);
  return r;
}

// A REAL CHOICE WIDGET. An option is a <label class="dopt"> over a hidden
// <input> — the label keeps the class, the exact word (the input contributes
// no text, so a gate's textContent match still holds and label.click() still
// activates it), and the .on paint; the input carries the checked state a
// screen reader can hear. `kind` is "radio" for a one-of-N question,
// "checkbox" for a set of independent toggles ("which notes are accented?"
// can have several on at once, and two checked radios in one group is a
// state HTML refuses to hold).
function optWidget(word, cls, { kind, name, on, dead, key, take, hour }) {
  const lab = el("label", cls);
  const r = el("input");
  r.type = kind; r.name = name; r.checked = !!on;
  r.dataset.k = key;
  if (dead) { r.disabled = true; lab.disabled = true; }  // the gates read .disabled off the .dopt
  // ...and, on the circle of fifths, WHICH HOUR this word sits at. It rode
  // twelve numbered classes (.da0….da11) whose whole content was one
  // number each — class soup for a datum — and the datum belongs on the
  // element. The paint is unchanged: band.css still walks --a out the
  // radius and rotates the word back upright.
  if (hour != null) lab.style.setProperty("--a", hour * 30 + "deg");
  r.addEventListener("click", take);
  lab.append(r, document.createTextNode(word));
  return lab;
}

// A QUESTION'S OPTIONS ARE THE ONE THING THAT IS NOT A TABLE. A one-of-N is
// a run of radio-labels in a <fieldset> under its <legend> — nothing about
// it is a grid of names against values, and forcing a table on it would put
// the answers in cells whose columns mean nothing. So they render as the
// plainest markup that fits: the labels, in order, in the flow. The column
// grid they used to be laid out in went out with the rest of the layout
// (2026-08-23) — a long list is a long list, and the page scrolls.
// Row labels (the kick:, pianos:…) are plain <p>s in the same flow.
// There is no <select> anywhere on the page — the gates' tap helper still
// knows how to drive one (harmless), but nothing renders one. Toggle sets
// stay checkboxes, and the key question stays the circle of fifths (Paul:
// "Keep the circle of fifths!!!").

/* ---------- THE CIRCLE OF FIFTHS -----------------------------------------
   The key question, drawn as the object musicians actually keep in their
   heads: twelve majors on the outer ring in fifths order — C at the top,
   sharps clockwise — and each key's RELATIVE minor on an inner ring at the
   same hour. Every position is the same real radio-label every other
   question renders (class .dopt, the exact option word, a hidden input
   carrying the checked state), so the gates' textContent taps still land;
   the roundness is band.css alone (absolute within a square box,
   rotate/translate — no library, thin strokes), which means CSS-off
   degrades to a readable list and a screen reader hears the plain fieldset
   either way. The DOM order IS fifths order, so the keyboard tabs round
   the circle. Tapping an inner minor answers TWO questions in one gesture
   — the key of its relative major, then "minor" — because A minor IS
   "in A, minor", and the answer machinery composes: two answer() calls on
   an immutable model are exactly two taps' worth of truth. */
const FIFTHS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
// each hour's relative minor: [what the ring says, the key its TONIC answers]
// — tapping Am must sound A minor ("in A", minor), never C minor at C's
// hour; where the tonic's letter is not a KEYS spelling it lands on the
// enharmonic key the table does carry (C#m -> "in Db", G#m -> "in Ab")
const RELMIN = { C: ["Am", "A"], G: ["Em", "E"], D: ["Bm", "B"],
                 A: ["F#m", "F#"], E: ["C#m", "Db"], B: ["G#m", "Ab"],
                 "F#": ["D#m", "Eb"], Db: ["Bbm", "Bb"], Ab: ["Fm", "F"],
                 Eb: ["Cm", "C"], Bb: ["Gm", "G"], F: ["Dm", "D"] };
function keyCircle(q, who) {
  const box = el("div", "dcircle");
  const done = (before) => {
    if (model !== before) { push(false); announce(who, null); }
    asking = null; draw();
  };
  // the outer ring: the question's own options, placed by the hour
  FIFTHS.forEach((k, i) => {
    const o = q.opts.find((x) => x.w === "in " + k);
    if (!o) return;
    box.append(optWidget(o.w, "dopt dko" + (o.on ? " on" : "") +
                              (!o.on && o.istrue ? " istrue" : ""), {
      kind: "radio", name: "q-" + who + "-" + q.id, on: o.on, dead: o.dead,
      hour: i, key: "opt|" + who + "|" + q.id + "|" + o.w,
      take: () => { const before = model; o.take(); done(before); } }));
  });
  // the inner ring: the relative minors — one tap, two answers
  FIFTHS.forEach((k, i) => {
    if (!q.opts.some((x) => x.w === "in " + k)) return;
    const [w, tonic] = RELMIN[k];
    const on = model.song.key === tonic && !!model.song.minor;
    box.append(optWidget(w, "dopt dki" + (on ? " on" : ""), {
      kind: "radio", name: "q-" + who + "-" + q.id + "-rel", on,
      hour: i, key: "opt|" + who + "|" + q.id + "rel|" + w,
      take: () => {
        const before = model;
        model = answer(model, who, "key", "in " + tonic);
        model = answer(model, who, "mode", "minor");
        done(before);
      } }));
  });
  return box;
}

/* ---------- CHANGES OF OUR OWN — the picker ------------------------------
   (PLAN.md THE THROUGH-COMPOSED THEME §2.) A bar list, one row per chord:
   tapping a row opens ITS controls below it (menus insert below the row,
   never scrolling inside themselves) — the root on the circle-of-fifths
   paint the key question already wears (twelve positions: the seven degrees
   of the record's key and mode plus their borrowed neighbours, every one a
   real .dopt radio-label), the quality, "two chords in this bar" (the
   Em7|A7 bar) and "lean into the next" (dominantOf, stored as DATA in the
   list — un-leaning is re-picking the root). Every edit lands through
   Band.setChanges, the same public API the dice rolls through, so the
   authored list's length IS the section's length the moment it is written.
   CSS-off degrades to a readable fieldset — the circle is paint, the
   controls are HTML (the keyCircle law). */
let picker = null;                 // { role, open } — open = flat chord index
const PCNAME = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
// the twelve root positions of the record's key/mode: diatonic degrees
// exact, chromatic neighbours as the borrow that spells them
function rootOpts() {
  const md = MODES[Band.modeKeyOf(model.song)];
  const base = Band.B.KEYS[model.song.key] || 0;
  const out = [];
  for (let i = 0; i < 12; i++) {
    const pc = (7 * i) % 12;                 // fifths order round the circle
    let d = md.indexOf(pc), borrow = 0;
    if (d < 0) { d = md.indexOf((pc + 1) % 12); borrow = -1; }
    if (d < 0) { d = md.indexOf((pc + 11) % 12); borrow = 1; }
    if (d < 0) continue;
    out.push({ w: PCNAME[((base + pc) % 12 + 120) % 12], d, borrow, hour: i });
  }
  return out;
}
const chordWord = (c) => {
  const md = MODES[Band.modeKeyOf(model.song)];
  const base = Band.B.KEYS[model.song.key] || 0;
  const pc = ((base + md[((c.d % 7) + 7) % 7] + (c.borrow || 0)) % 12 + 120) % 12;
  const q = { dom7: "7", maj7: "maj7", m7: "m7", 7: "7th", nine: "9",
              sus4: "sus", six: "6", triad: "" }[c.q] || "";
  return PCNAME[pc] + q;
};
function chgxWidget(role) {
  const wrap = el("div", "dpick");
  const authored = !!(model.song.chgx || {})[role];
  const openBtn = el("button", "dfact dchgx" + (picker && picker.role === role ? " open" : ""),
                     authored ? "our changes, bar by bar…" : "changes of our own…");
  openBtn.type = "button";
  openBtn.dataset.k = "chgx|" + role;
  openBtn.addEventListener("click", () => {
    picker = picker && picker.role === role ? null : { role, open: null };
    draw(); });
  wrap.append(openBtn);
  if (!picker || picker.role !== role) return wrap;
  // the list in hand: the authored one, else the catalog materialized —
  // the escape starts from what you heard (a called lean included)
  const c = Band.changesOf(model, role);
  const list = authored ? JSON.parse(JSON.stringify(model.song.chgx[role]))
    : c.leaned ? c.prog.map((b2) => (Array.isArray(b2) ? b2 : [b2])
        .map((cc) => ({ d: cc.d, ...(cc.q ? { q: cc.q } : {}),
                        ...(cc.borrow ? { borrow: cc.borrow } : {}) })))
    : c.roots.map((d) => [{ d }]);
  const write = (nl) => {
    const before = model;
    model = Band.setChanges(model, role, nl);
    if (model !== before) { push(false); announce("arranger", null); }
    draw(); };
  // ONE TABLE, one row per CHORD: the tappable bar number is the row's own
  // name, the chord is its value, and an open bar's controls land in a row
  // of their own directly beneath it.
  const bars = tableOf("the changes, bar by bar");
  wrap.append(bars);
  const flat = [];
  list.forEach((bar, bi) => bar.forEach((cc, ki) => flat.push({ cc, bi, ki })));
  flat.forEach(({ cc, bi, ki }, ci) => {
    const rowB = el("button", "dfact dpickbar" + (picker.open === ci ? " open" : ""),
                    ki ? "and" : "bar " + (bi + 1));
    rowB.type = "button";
    rowB.dataset.k = "pbar|" + role + "|" + ci;
    rowB.addEventListener("click", () => {
      picker.open = picker.open === ci ? null : ci; draw(); });
    const tr = trOf(rowB, chordWord(cc));
    bars.append(tr);
    if (picker.open !== ci) return;
    const open = el("td");
    open.colSpan = 2;
    { const r = el("tr"); r.append(open); tr.after(r); }
    // the root, on the circle's own paint
    const circle = el("div", "dcircle dpcircle");
    for (const o of rootOpts()) {
      const on2 = cc.d === o.d && (cc.borrow || 0) === o.borrow;
      circle.append(optWidget(o.w, "dopt dko" + (on2 ? " on" : ""), {
        kind: "radio", name: "pk-root-" + ci, on: on2,
        hour: o.hour, key: "opt|arranger|chgx:" + role + ":root" + ci + "|" + o.w,
        take: () => {
          const nl = JSON.parse(JSON.stringify(list));
          const t = nl[bi][ki];
          t.d = o.d; if (o.borrow) t.borrow = o.borrow; else delete t.borrow;
          write(nl); } }));
    }
    open.append(circle);
    // the quality — plain, a seventh by function, or the record's own kind
    const QROW = [["plain", (d) => "triad"],
                  ["a seventh", (d) => Band.CHORDKIND.sevens.q(((d % 7) + 7) % 7)],
                  ["the record’s own", () => null]];
    const qrow = el("p");
    for (const [wq, fq] of QROW) {
      const want = fq(cc.d);
      const on2 = want === null ? cc.q == null : cc.q === want;
      qrow.append(optWidget(wq, "dopt" + (on2 ? " on" : ""), {
        kind: "radio", name: "pk-q-" + ci, on: on2,
        key: "opt|arranger|chgx:" + role + ":q" + ci + "|" + wq,
        take: () => {
          const nl = JSON.parse(JSON.stringify(list));
          const t = nl[bi][ki], want2 = fq(t.d);
          if (want2 === null) delete t.q; else t.q = want2;
          write(nl); } }), " ");
    }
    // ...and the bar's two marks: the split, and the lean
    const split = list[bi].length > 1;
    qrow.append(optWidget("two chords in this bar", "dopt" + (split ? " on" : ""), {
      kind: "checkbox", name: "pk-x-" + ci, on: split,
      key: "opt|arranger|chgx:" + role + ":split" + ci + "|two chords in this bar",
      take: () => {
        const nl = JSON.parse(JSON.stringify(list));
        nl[bi] = split ? [nl[bi][0]] : [nl[bi][0], { ...nl[bi][0] }];
        write(nl); } }), " ");
    qrow.append(optWidget("lean into the next", "dopt" + (cc.q === "dom7" ? " on" : ""), {
      kind: "checkbox", name: "pk-x-" + ci, on: cc.q === "dom7",
      key: "opt|arranger|chgx:" + role + ":lean" + ci + "|lean into the next",
      take: () => {
        const nl = JSON.parse(JSON.stringify(list));
        const next = flat[(ci + 1) % flat.length];
        nl[bi][ki] = Band.dominantOf(list[next.bi][next.ki],
                                     MODES[Band.modeKeyOf(model.song)]);
        write(nl); } }), " ");
    open.append(qrow);
  });
  // the foot: grow, shrink, go round again
  const foot = el("div", "dpickfoot");
  const footBtn = (w, k, fn, dead) => {
    const b2 = el("button", "dmark", w);
    b2.type = "button"; b2.dataset.k = "pick|" + role + "|" + k;
    if (dead) b2.disabled = true;
    b2.addEventListener("click", fn);
    foot.append(b2, " "); };
  footBtn("add a bar", "add", () => {
    const nl = JSON.parse(JSON.stringify(list));
    nl.push(JSON.parse(JSON.stringify(nl[nl.length - 1])));
    write(nl); }, list.length >= 16);
  footBtn("take a bar away", "cut", () => {
    const nl = JSON.parse(JSON.stringify(list)); nl.pop();
    write(nl); }, list.length <= 2);
  footBtn("go round again", "loop", () => {
    const nl = JSON.parse(JSON.stringify(list));
    write(nl.concat(JSON.parse(JSON.stringify(nl))).slice(0, 16)); },
    list.length > 8);
  wrap.append(foot);
  return wrap;
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

/* ---------- THE FRONT DOOR -----------------------------------------------
   (2026-08-22, Paul, looking at his own screen: "There no count it in
   button.") He was right, and the bug was bigger than the button. The
   invitation was drawn only while `model.on` was false — a state a page
   leaves once and never comes back to — so a RETURNING visitor (the session
   is remembered in localStorage) landed mid-interview with no way in, and
   "start again" reset the model without changing the shape of the screen.
   Measured on the live page before this: reload after one answer gave
   `hasCountIn: false`, the question "where are you?" sitting on the floor of
   a page otherwise full of themes, boxes, six chairs and the producer.

   So the door is not a state of the boot any more, it is a state of the
   RECORD: it stands whenever nothing has been called (`song.genre` unset) —
   a virgin visit, a remembered half-answered session, and every "start
   again" — and it carries three things and nothing else:

     · one line saying what this is and what to do,
     · "count it in" (the exact words the gates tap, a real <button>), which
       still lands the demonstration record the room opens with, and
     · THE RUN: when · where · the room, one question at a time, with the
       ones already said standing above it as facts you can tap to change.

   It is not a second view and not a mode — the page is the same single
   scroll it always was, and the four areas are still drawn, in order, with
   their own headings, fully expanded. Nothing below the door competes with
   the question because the arranger's own sheet renders QUIET while the
   door holds the floor and the record's three rows are the door's own; no
   gate loses a node it reads.

   The one-question law is untouched: the door holds the floor only when the
   floor is the arranger's own (the song area, nothing else being re-asked),
   which is exactly when its three would have been the next question anyway.
   Tap "producer" or "themes" and that area's question takes the floor as it
   always did — the door keeps its line and its trail and asks nothing. */
const THREE = ["when", "where", "venue"];
// the door's own rows: the three, and — only when all three are said and
// they STILL leave several records standing — the record itself. Three
// answers usually call one (the last one standing is called without being
// asked), but "the seventies · London · a bar" is four records deep, and a
// door that runs out of questions with nothing called would hand the last
// word to a question folded away inside the song area.
const doorRows = () => {
  const ds = seatDecisions(model, "arranger");
  const rows = THREE.map((f) => ds.find((d) => d.id === f)).filter(Boolean);
  if (rows.length && rows.every((d) => d.answered)) {
    const g = ds.find((d) => d.id === "genre");
    if (g) rows.push(g);
  }
  return rows;
};
// which row holds the floor, if the door holds it at all
function doorQ(rows) {
  if (module_ !== "song" || section != null) return null;
  if (asking != null) return rows.find((d) => d.id === asking) || null;
  return rows.find((d) => !d.answered) || null;
}

// the question, drawn the way every other question on this page is drawn —
// a fieldset, its legend the .dq, and its options as plain radio-labels in
// the flow — fourteen decades is fourteen labels and the page scrolls
function doorAsk(d) {
  const ask = el("fieldset", "dask");
  ask.append(el("legend", "dq", d.ask));
  for (const o of d.opts)
    ask.append(optWidget(o.w, "dopt" + (o.answered ? " on" : ""), {
      kind: "radio", name: "q-arranger-" + d.id, on: !!o.answered,
      key: "opt|arranger|" + d.id + "|" + o.w,
      take: () => {
        const before = model;
        model = answer(model, "arranger", d.id, o.w);
        if (model !== before) {
          // SAYING SOMETHING COUNTS THE BAND IN. `on` is what arms the
          // auto-start (the `armed` hook at the foot of this file), and a
          // visitor who answers the first question rather than tapping the
          // chip should hear the record they are calling, not silence.
          if (!model.on) model = { ...model, on: true };
          push(false); announce("arranger", null);
        }
        asking = null;
        draw();
      } }), " ");
  return ask;
}

// the door. Returns whether it took the floor — the song area's arranger
// sheet renders quiet when it did, so the page never carries two questions.
function frontDoor(box) {
  const rows = doorRows();
  const q = doorQ(rows);
  box.append(el("p", null,
    "A band, and a record made of three answers: when it is, where you are, " +
    "and the room you play in. Count it in and say."));
  const c = el("button", "dchip", "count it in");
  c.type = "button";
  c.dataset.k = "start";
  c.addEventListener("click", () => {
    const was = model.on;
    model = { ...model, on: true };
    if (!was) ledger.push("a band, waiting to be told what the tune is");
    // COUNTING IN STARTS THE RECORD (2026-08-22, Paul: "The start again
    // 'default' song should play and interpret the theme and its answer
    // across a verse-chorus structure"). A first count-in lands the whole
    // record (`push(true)` — the session skeleton adopt); counting in a
    // session that is already standing only pushes what it has, because a
    // skeleton adopt would throw away a returning visitor's board.
    push(!was); draw();
    if (!playing) startAt(0);
    playWord(true);
  });
  box.append(c);
  // THE RUN, as the same name-and-value rows every other table on this page
  // is made of: an answered one says its word, the one in front of you says
  // its question and carries it in a row of its own beneath. Three rows,
  // always — you can see the whole path from the first tap, which is the
  // difference between a run and a surprise.
  const table = tableOf("the record");
  for (const d of rows) {
    const f = el("button", "dfact", d.id);
    f.type = "button";
    f.dataset.k = "fact|" + d.id;
    f.title = d.answered ? "change it: " + d.ask : d.ask;
    f.addEventListener("click", () => {
      module_ = "song"; section = null;
      asking = asking === d.id ? null : d.id; draw(); });
    const tr = trOf(f, d.answered || d.ask);
    table.append(tr);
    // the one in front of you carries its question under its own row — the
    // value cell would only say the legend twice, which is what the whole
    // door exists to stop
    if (q && q.id === d.id) askRow(tr, doorAsk(d));
  }
  box.append(table, el("hr"));
  if (q) floorQ = "arranger|" + q.id + "|door";
  return !!q;
}

// ...and once it IS called, the record says its own name at the top — the
// three answers it was made of, in one line. It is the headline of the page
// the door just opened, and it is what a returning visitor reads first.
function calledLine() {
  const gk = Band.GENRES[model.song.genre];
  const said = THREE.map((f) => model.song[f]).filter(Boolean).join(" · ");
  return el("p", null,
    (gk ? gk.w : model.song.genre) + (said ? " — " + said : ""));
}

function draw() {
  const box = $("dwrap");
  const wasIn = box.contains(document.activeElement);
  const wasKey = (wasIn && document.activeElement.dataset.k) || null;
  floorQ = null;
  render(box);
  if (wasIn) {
    const first = floorQ && floorQ !== lastQ &&
      box.querySelector(".dask .dopt input");
    const same = !first && wasKey &&
      box.querySelector('[data-k="' + CSS.escape(wasKey) + '"]');
    if (first) first.focus(); else if (same) same.focus();
  }
  lastQ = floorQ;
}

function render(box) {
  box.textContent = "";
  // THE DOOR IS A STATE OF THE RECORD, not of the boot: it stands whenever
  // nothing has been called, and every fold below reads this.
  doorShut = !model.song.genre;
  // TAP AWAY FROM ANYTHING. Nothing here has to be dismissed: tapping the
  // floor closes whatever is open (a section being arranged, a fact being
  // changed), and tapping another thing just opens that one instead.
  box.onclick = (e) => {
    if (e.target !== box) return;
    if (asking == null && section == null && picker == null &&
        pverb == null && psubj == null) return;
    asking = null; section = null; picker = null;
    pverb = null; psubj = null; draw();
  };

  // THE FRONT DOOR, whenever no record has been called (frontDoor above):
  // the invitation, "count it in", and the run of three. The areas below are
  // still drawn, in full — one page, one scroll, no modes — and the
  // arranger's own sheet renders QUIET while the door holds the floor, so
  // exactly one question is ever on it.
  const doorFloor = doorShut ? frontDoor(box) : false;
  if (!doorShut) box.append(calledLine());

  // ---- THEMES ---- (the ideas module by its right name — PLAN Phase 2
  // renames the organ; the page starts saying the word now). An area is a
  // heading and what is under it, in the flow: no <section> wrapper, no
  // fold, nothing to open.
  const hThemes = el("h2");
  hThemes.append(modButton("themes", "ideas"));
  box.append(hThemes);
  // NO PROSE (2026-08-21). Two paragraphs used to explain what a theme is
  // and how to add one — "don't sneak in explanations". The outline IS the
  // explanation: the staff, the theme's own named node, and its questions.
  // The theme itself, written down: the staff stands whenever the record
  // has the tune, and follows every edit — a lifted note, a new key —
  // because draw() recompiles the ABC each pass and re-engraves on change
  // ...and NOT while the front door stands: nothing has been called yet, so
  // an engraving there is a picture of nothing — and drawing it would
  // fire the lazy `import()` of the abcjs chunk during boot, BEFORE the
  // service worker has taken control of this page's fetches, which is a
  // request the worker never sees and therefore never caches. Measured:
  // engraving at boot made band-offline.test.js fail on exactly one URL with
  // the wire cut, /vendor/abcjs/*. The staff engraves when the record is
  // called, seconds later, through the worker, and is cached like everything
  // else. (themeStaff's own null branch clears the kept hosts; skipping the
  // call leaves them alone, which is what a quiet door wants.)
  const staff = doorShut ? null : themeStaff(model);
  if (staff) box.append(staff);
  if (module_ === "ideas" && section == null) chairArea(box, "arranger", true, doorFloor);
  box.append(el("hr"));

  // ---- SONG ---- the record's structure AS A TABLE (2026-08-23): one row
  // per box — the box's own name in the row's <th> (the same .dsec button
  // the gates click and the playhead lights), and the three moves a hand
  // makes on it in the cell beside it. The open box's questions land in a
  // row of their own directly beneath, and "add a box" is the last row.
  const hSong = el("h2");
  hSong.append(modButton("song", "song"));
  box.append(hSong);
  const song = toSong(model, MODES);
  const stable = tableOf("the song's sections");
  cells = [];
  song.forEach((s2, i) => {
    cells[i] = [[]];
    const b = el("button", "dsec" + (section === i ? " open" : ""));
    b.type = "button";
    b.dataset.k = "sec|" + i;
    b.title = "what is everyone doing here?";
    // the box's name reads by the colon law ("head: 4 bars"), the extra
    // words comma-joined after it — one plain string — and the hint the
    // title used to hoard is words in the name too: .dvh, text AT can
    // reach, invisible.
    const per = s2.per || {};
    const diff = [per.drums && Band.SECDRUMS[per.drums] && Band.SECDRUMS[per.drums].w,
                  per.bass && Band.SECBASS[per.bass] && Band.SECBASS[per.bass].w]
                 .filter(Boolean);
    b.append(s2.role + ": " + s2.bars + " bars" +
             (diff.length ? ", " + diff.join(", ") : ""));
    b.append(el("span", "dvh", " — what is everyone doing here?"));
    b.addEventListener("click", () => {
      module_ = "song";
      section = section === i ? null : i; asking = null; draw(); });
    cells[i][0].push(b);
    const tr = el("tr");
    const th = el("th"); th.scope = "row"; th.append(b);
    const td = el("td");
    tr.append(th, td);
    stable.append(tr);
    // THE BOXES ARE REAL (2026-08-22, Paul: "'add a box' doesn't really add
    // a box. i can't move boxes around"). Every row carries the three moves
    // a hand makes on a record's shape, IN WORDS — no icons, no drag
    // handles, no tracker interface: "move up", "move down", "remove". A
    // move that cannot be made is not drawn (the first box has no up, the
    // last no down) rather than drawn dead, and a record cannot be emptied,
    // so the last box left has no remove. The box's own conversation still
    // opens by tapping its name; these are about the BOX.
    const opBtn = (word, k, run) => {
      const o = el("button", "dboxop", word);
      o.type = "button";
      o.dataset.k = k + "|" + i;
      o.append(el("span", "dvh", " — the " + s2.role));
      o.addEventListener("click", run);
      td.append(o, " ");
    };
    const boxMove = (m2, keep) => {
      if (m2 === model) return;
      model = m2; section = keep; asking = null;
      push(false); announce("arranger", null); draw();
    };
    if (i > 0) opBtn("move up", "boxup",
      () => boxMove(Band.moveSection(model, i, -1), section === i ? i - 1 : section));
    if (i < song.length - 1) opBtn("move down", "boxdown",
      () => boxMove(Band.moveSection(model, i, 1), section === i ? i + 1 : section));
    if (song.length > 1) opBtn("remove", "boxdel",
      () => boxMove(Band.removeSection(model, i), null));
    // the open box's whole conversation, in a row of its own beneath it
    if (section === i) { const r = el("tr"); const c2 = el("td"); c2.colSpan = 2;
      sectionArea(c2); r.append(c2); stable.append(r); }
  });
  // A BOX IS A SECTION OF THE SONG, and now it really is one: "add a box"
  // asks the one thing a new box needs — WHAT KIND — and lands it after the
  // box you have open, or at the end when none is.
  if (song.length < Band.MAXSECS) {
    const r = el("tr");
    const c2 = el("td"); c2.colSpan = 2;
    const add = el("button", "dadd" + (adding ? " open" : ""), "add a box");
    add.type = "button";
    add.dataset.k = "addbox";
    add.title = "a new section, after the one you have open";
    add.addEventListener("click", () => { adding = !adding; draw(); });
    c2.append(add);
    if (adding) {
      const at = section == null ? song.length : section + 1;
      const ask = el("fieldset", "dask");
      ask.append(el("legend", "dq", "what kind of box?"));
      for (const [k, w] of Object.entries(Band.SECROLES))
        ask.append(optWidget(w, "dopt", { kind: "radio", name: "addbox", on: false,
          key: "opt|addbox|" + k,
          take: () => {
            const m2 = Band.addSection(model, at, k);
            if (m2 === model) return;
            model = m2; adding = false; section = at; asking = null;
            push(false); announce("arranger", null); draw();
          } }), " ");
      c2.append(ask);
    }
    r.append(c2);
    stable.append(r);
  }
  box.append(stable);
  if (section == null && module_ === "song") chairArea(box, "arranger", false, doorFloor);
  box.append(el("hr"));

  // ---- THE BAND ---- the members, each a row that says how much it still
  // has to decide. Tap one and its questions take the floor.
  const hBand = el("h2");
  // the visible heading reads "the band"; the button inside it is the word
  // the gates (and a finger) press — but its accessible NAME is the
  // heading's whole phrase: "band" alone is not a thing on this page
  const mbBand = modButton("band", "band");
  mbBand.setAttribute("aria-label", "the band");
  hBand.append(document.createTextNode("the "), mbBand);
  box.append(hBand);
  // THE CHAIRS AS A TABLE (2026-08-23): one row per seat, its label the
  // same .dseat button it always was, and the seat you are IN carries its
  // whole gig sheet in the row beneath — expanded, never folded.
  const seats = tableOf("the chairs");
  for (const s2 of SEATS.filter((x) => x !== "arranger")) {
    // HOW MANY, NOT WHETHER. This said "1 question" for every chair that
    // had any question left at all — a chair with nine things still to
    // decide and a chair with one looked identical, which is exactly the
    // thing a session needs to tell you.
    const left = Band.pending(model, s2);
    const b = el("button", "dseat" + (seat === s2 ? " on" : ""));
    b.type = "button";
    b.dataset.k = "seat|" + s2;
    // the colon law joins the seat to its phrase ("drums: questions left:
    // 3"), and the count stays the LAST thing in the label (a gate reads
    // the trailing digits — /(\d+)$/, so the digits may not move off the
    // end); when nothing is left it is a word, not a checkmark. The whole
    // row IS this one control, so the cell is a <td>: there is no second
    // column for a scope="row" to point at.
    b.append(s2 + ": " + (left ? "questions left: " + left : "all set"));
    b.addEventListener("click", () => {
      seat = s2; module_ = "band"; section = null; asking = null; draw(); });
    const tr = el("tr");
    const td = el("td"); td.append(b); tr.append(td);
    seats.append(tr);
    // only the seat you are in carries its sheet — the one-question law is
    // untouched, and the other chairs stay one line each
    if (module_ === "band" && section == null && seat === s2) {
      const r = el("tr"); const c2 = el("td");
      chairArea(c2, s2, false);
      r.append(c2); seats.append(r);
    }
  }
  box.append(seats, el("hr"));

  // ---- THE PRODUCER ---- the last area, because it is the last word: the
  // band plays the record and somebody with taste says five or six things
  // about it. Same idiom as everything above — a heading that is the button
  // bringing its question to the floor, a table of what has been said, and
  // one question at a time.
  const hProd = el("h2");
  const mbProd = modButton("producer", "prod");
  mbProd.setAttribute("aria-label", "the producer");
  hProd.append(document.createTextNode("the "), mbProd);
  box.append(hProd);
  producerArea(box);
}

/* ---------- THE PRODUCER -------------------------------------------------
   ONE SENTENCE SHAPE, BUILT BY TAPPING, three taps at most:

       [VERB]  [SUBJECT]  [DESCRIPTOR]

   There is no text box and no parser anywhere — the sentence is ASSEMBLED
   by the taps rather than read from them, which is why every combination
   the page offers is one producer.js can actually make (and why an
   unsayable sentence is never offered rather than guessed at).

   THE NOTES ARE THE INTERFACE. A statement is not fire-and-forget: it is a
   LINE the record remembers, carrying a plus, a minus and a percentage —
   the real lerp coefficient, 40% on the first press and asymptotic after —
   so the record IS the base plus the visible stack, and undo is taking a
   line off. */
let pverb = null, psubj = null;         // the sentence being built, tap by tap
const PASKW = { make: "make what?", more: "more of what?", less: "less of what?",
                add: "add what?", away: "take away what?",
                only: "keep only what?" };
function producerArea(parent) {
  const R = produced(model);
  const notes = Prod.notesOf(model);
  const land = () => { pverb = null; psubj = null;
    push(false); announce("producer", null); draw(); };
  // ---- WHAT HAS BEEN SAID, and what it did ----
  if (notes.length) {
    // one row per note: the sentence (tapping it says it again, harder),
    // how far along it is and what it moved in the band's own words, and
    // the three things a hand does to a note.
    const table = tableOf("the producer's notes");
    table.className = "dnotes";
    R.said.forEach((line, i) => {
      const b = el("button", "dnote", line.sentence);
      b.type = "button";
      b.dataset.k = "note|" + i;
      b.title = "say it again, harder";
      b.addEventListener("click", () => { model = Prod.bump(model, i, +1); land(); });
      const tr = trOf(b, Prod.pct(line.note.w) + "% — " + line.said.join(", "));
      const td = el("td");
      const op = (word, k, run) => {
        const o = el("button", "dboxop", word);
        o.type = "button";
        o.dataset.k = k + "|" + i;
        o.append(el("span", "dvh", " — " + line.sentence));
        o.addEventListener("click", run);
        td.append(o, " ");
      };
      op("more", "pnup", () => { model = Prod.bump(model, i, +1); land(); });
      op("less", "pndn", () => { model = Prod.bump(model, i, -1); land(); });
      op("take it off", "pndel", () => { model = Prod.drop(model, i); land(); });
      tr.append(td);
      table.append(tr);
    });
    parent.append(table);
    const clear = el("button", "dfact", "forget all of it");
    clear.type = "button";
    clear.dataset.k = "pclear";
    clear.title = "take every note off and hear the record the band made";
    clear.addEventListener("click", () => { model = Prod.clearNotes(model); land(); });
    parent.append(clear);
  }
  if (module_ !== "prod" || section != null) return;
  floorQ = "prod|" + (pverb || "") + "|" + (psubj || "");
  const ask = el("fieldset", "dask");
  parent.append(ask);

  // ---- TAP ONE: THE VERB. Six, and no more — a producer with a hundred
  // words is a menu, and Paul asked for the world's simplest grammar.
  if (!pverb) {
    if (notes.length >= Prod.MAXNOTES) {
      // the number comes from the producer's own constant, so the sentence
      // cannot go stale the way it did when the ceiling moved from six to ten
      ask.append(el("legend", "dq",
        "that is " + Prod.MAXNOTES + " things — take one off before you say another"));
      return;
    }
    ask.append(el("legend", "dq", "what do you want to say?"));
    for (const v of Prod.VERBS) {
      const lab = optWidget(v.w, "dopt", { kind: "radio", name: "pverb", on: false,
        key: "opt|pverb|" + v.id,
        take: () => { pverb = v.id; psubj = null; draw(); } });
      lab.title = v.says;
      ask.append(lab, " ");
    }
    return;
  }

  // ---- TAP TWO: THE SUBJECT, and it is the WHOLE TREE — the record, each
  // chair, each chair's own components, and the mix. "More drums" and "more
  // kick" are the same sentence at two depths.
  if (!psubj) {
    ask.append(el("legend", "dq", PASKW[pverb] || "what?"));
    // the subject tree is a QUESTION's options, so it is not a table: it is
    // a plain nested <ul> of radio-labels ("more drums" and "more kick" are
    // the same sentence at two depths), which the browser indents itself.
    const tree = el("ul");
    const byParent = new Map();
    // WHAT THIS VERB CAN TAKE HOLD OF ON THIS RECORD. A verb that takes no
    // descriptor is a two-tap sentence, so the record-dependent honesty test
    // has to happen here — "less bass line" on a bass already holding one
    // note is as sparse as it is going to get, and it is not offered.
    const can = new Set(Prod.subjectsFor(model, R.base, pverb).map((x) => x.id));
    for (const s2 of Prod.SUBJ) {
      if (!can.has(s2.id)) continue;
      const list = byParent.get(s2.under || null) || [];
      list.push(s2); byParent.set(s2.under || null, list);
    }
    const node = (s2) => {
      const li = el("li");
      // "more"/"less" say the subject BARE ("more kick"); everything else
      // says it with its article ("take away the kick"). Two-tap sentences
      // have to be English too.
      const word = (pverb === "more" || pverb === "less") ? s2.bare : s2.w;
      li.append(optWidget(word, "dopt", { kind: "radio", name: "psubj", on: false,
        key: "opt|psubj|" + s2.id,
        take: () => {
          if (Prod.VERB[pverb].d === "no") {
            model = Prod.addNote(model, pverb, s2.id); land(); return;
          }
          psubj = s2.id; draw();
        } }));
      const kids = byParent.get(s2.id);
      if (kids) { const ul = el("ul");
        for (const k of kids) ul.append(node(k));
        li.append(ul); }
      return li;
    };
    for (const s2 of byParent.get(null) || []) tree.append(node(s2));
    // a component whose own chair this verb cannot take still gets a row —
    // the tree may not swallow a subject the producer can actually move
    for (const [parent2, list] of byParent)
      if (parent2 && !can.has(parent2)) for (const s2 of list) tree.append(node(s2));
    ask.append(tree);
    return;
  }

  // ---- TAP THREE: THE DESCRIPTOR — a genre or an adjective, and only the
  // ones that are HONEST for this subject on THIS record. The offering is
  // computed, not listed: a target is offered only if the first press would
  // actually move this record (producer.js firstStep), which is what stops
  // "I tapped it and nothing happened".
  const S = Prod.SUB[psubj];
  ask.append(el("legend", "dq",
    (pverb === "add" ? "add " + S.w + " — like what?"
                     : "make " + S.w + " — what?")));
  const opts = Prod.targetsFor(model, R.base, pverb, psubj);
  const adjs = opts.filter((o) => o.kind === "adj");
  const gens = opts.filter((o) => o.kind === "genre");
  for (const o of opts.filter((x) => x.kind === "bare")) put(ask, o);
  const put = (host, o) => {
    const lab = optWidget(o.w, "dopt",
      { kind: "radio", name: "pdesc", on: false, key: "opt|pdesc|" + o.id,
        take: () => { model = Prod.addNote(model, pverb, psubj, o.id); land(); } });
    // the anchor's own label is what the word MEANS ("punk" is New York
    // 1976) — a title, not a second word on the page
    if (o.label) lab.title = o.label;
    host.append(lab, " ");
  };
  if (adjs.length) {
    ask.append(el("p", null, "in a word:"));
    const row = el("p");
    for (const o of adjs) put(row, o);
    ask.append(row);
  }
  if (gens.length) {
    ask.append(el("p", null, "or like a record:"));
    const row = el("p");
    for (const o of gens) put(row, o);
    ask.append(row);
  }
  if (!adjs.length && !gens.length)
    ask.append(el("p", null, "nothing here would move " + S.w +
      " on this record. Try another one."));
}

// A SECTION IS OPEN: everything on the floor is about this section. Each
// player's canned parts, then their OWN words — "swap hands", "ride it",
// "walk it" — then the two things a band says that neither player owns
// alone ("give it a lift", "follow the kick").
function sectionArea(parent) {
  const secs = toSong(model, MODES);
  const here = secs[section];
  floorQ = "sec|" + section;
  // A SECTION IS A RUN OF QUESTIONS, and a question is not a name-and-value
  // pair, so this one region is not a table: the fieldsets stand in the
  // flow, in order, all on the floor at once, exactly as the gates read
  // them. The tree that used to indent a player's own words ("at the kit",
  // "the bass player") under that player's own question is gone with the
  // rest of the hierarchy; the words simply follow the player they belong
  // to, which is the same order and one nesting level fewer.
  const WORDSOF = { dwords: "drums", kwords: "keys", gwords: "guitar",
                    bwords: "bass", vwords: "voice" };
  const askOf = new Map();
  for (const a2 of sectionAsks(model, section)) {
    // a question and its answers are ONE form group — fieldset binds the
    // options to the legend, which stays the .dq the gates read
    const ask2 = el("fieldset", "dask");
    ask2.append(el("legend", "dq", "in the " + (here ? here.role : "section") +
                   ", " + a2.who + "…"));
    // scoped to THIS section: the change can only be heard when the
    // section next comes round, and the countdown says so — the label
    // stays the unique key; who/role are the words the phrasing uses
    const takeSec = (o) => () => {
      model = setSection(model, section, a2.id, o.key);
      push(false);
      announceChange(a2.who + " in the " + (here ? here.role : "section"), section,
                     { who: a2.who, role: here ? here.role : "section" });
      draw();
    };
    // a player's own words run long (34 at the kit) — the same plain
    // radio-labels either way, straight into the fieldset
    for (const o of a2.opts) {
      ask2.append(optWidget(o.w, "dopt" + (o.answered ? " on" : ""), {
        kind: "radio", name: "sq-" + section + "-" + a2.id, on: o.answered,
        key: "opt|sec" + section + "|" + a2.id + "|" + o.key,
        take: takeSec(o) }), " ");
    }
    askOf.set(a2.id, ask2);
    // the words-question follows the player it belongs to; a pruned player
    // (nothing to ask) leaves its words where they fall rather than
    // dropping them
    const pAsk = WORDSOF[a2.id] && askOf.get(WORDSOF[a2.id]);
    if (pAsk) pAsk.after(ask2); else parent.append(ask2);
  }
}

/* ---------- THE COUNT ROW ------------------------------------------------
   "on the e of the one" sixteen times over is a word-pile; a bar is a 4×4
   GRID — columns one two three four, rows the beat / e / and / a — and the
   sentence stays the contract: every cell's tapped word is stepWord's own,
   byte for byte, so nothing a gate (or a ledger) ever read has moved. The
   MARK row above the grid chooses what a tap puts at that place (a note, an
   octave, an accent, a slide…) — everything past the note greys until a
   note exists there, which is the kit's own when-guard made visible. */
const stepWordRaw = Band.B.stepWord;        // one table, every chair counts alike
// ...and the record's own way of counting rides with it: "on the a of three"
// in a waltz, "on the and of five" in a six. The SENTENCE never changes shape
// (which is what keeps every tap-by-textContent gate reading), only the
// numbers in it — and an unanswered record counts to four exactly as before.
const metNow = () => Band.metOf(model.song);
const stepWord = (i) => stepWordRaw(i, metNow());
const stepsNow = () => Band.stepsOfSong(model.song);
// a CELL of the count grid — a pitched chair's hit:/note: places, the
// drummer's lane-scoped step:<lane>:<i> — as opposed to the named-shape
// words (shape:<lane>:…) that stay chips under it
const isCellId = (id) => /^(note|hit):\d+$/.test(id) || /^step:[^:]+:\d+$/.test(id);
const barMarks = new Map();                  // who -> which mark is in hand
// which kits have marks beyond the note itself; a pitched chair's bar is
// single-mark (a chord / a strum / sing) and gets the grid alone
const marksOf = (who) =>
  who === "bass" ? Band.B.BARMARKS
  : who === "arranger" ? Band.Id.BARMARKS
  // the drummer's marks are the KIT itself: pick the drum, then say where it
  // goes — the same lane-pinning the drums page does, drawn as the mark row
  : who === "drums" ? Band.D.LANES.map((l) => ({
      lane: l, w: { m: "mid tom", l: "floor tom" }[l] || Band.D.LANEOF(l),
      id: (i) => "step:" + l + ":" + i }))
  : [{ w: null, id: (i) => "hit:" + i }];
// the groups the marks absorb: their words survive as cells under a mark,
// never as a subject question of their own
const MERGED = new Set(["octaves in the bar", "accents in the bar",
                        "notes in the bar", "slides in the bar",
                        "higher", "lower", "held", "the bar in hand"]);
// the labeled rows, in the order a musician lists them — kit first, then
// the machine panel, then the keys families
const ROWORDER = ["the kick:", "the snare:", "the hats:", "the toms:",
                  "the accents:", "the one:", "calls:",
                  "the filter:", "the squelch:", "the envelope:",
                  "how it closes:", "the wave:",
                  "pianos:", "organs:", "pads & strings:", "synths:", "voices:"];

/* ---------- THE LABEL COLUMN ---------------------------------------------
   The outline's label is a WORD a musician would say, never an id: `atk` is
   "how it comes in", `keysfx` is "the keys", `knob:maxHold` is "how long
   notes hold". ONE table, word per question id — a seat-qualified key wins
   where two chairs share an id (the bass's `reg` is "how low", the theme's
   is "where it sits") — and anything unnamed falls back to its id with the
   prefixes stripped, so a colon-id can never reach the sheet. The
   section-role calls (chg:/len:) are labeled with the ROLE THE RECORD
   SHOWS: band-kit CHGROLE folds build→verse and drop→chorus, and a sheet
   saying "the verse changes" over a record whose boxes read
   build/drop/break would name a role no box on screen has. */
const QLABEL = {
  chords: "the chords",
  mcolor: "the colour",
  "knob:scale": "the scale", "knob:diatonic": "following the chords",
  "knob:stress": "leaning on the beat", "knob:kitProb": "how many hats land",
  "knob:fill": "what fills are made of",
  "knob:phrase": "how the line breathes", "knob:maxHold": "how long notes hold",
  "knob:orn": "the decoration",
  instr: "the instrument", reg: "the register", cut: "how bright",
  atk: "how it comes in", rel: "how it lets go", col: "the colour",
  sit: "against the drums",
  verb: "the reverb", keysfx: "the keys", gtrfx: "the guitar",
  voxfx: "the voice", bassfx: "the bass", bassmix: "where the bass sits",
  "bass:reg": "how low",
  "arranger:len": "how long", "arranger:cell": "the rhythm of it",
  "arranger:contour": "the shape", "arranger:land": "where it lands",
  "arranger:reg": "where it sits", "arranger:sent": "how it speaks",
  second: "a second theme",
  reprise: "round again", doors: "how it opens and closes",
};
// the role a canonical section-role SHOWS on this record's boxes: the role
// itself when a box carries it, else the first box whose changes it takes
const roleShown = (r) => {
  const secs = Band.secsOf(model);          // the wrapped form — doors and all
  if (secs.includes(r)) return r;
  // several boxes can take one role's changes (a twelve-inch's intro, build
  // and break all take the verse's) — the OWNER a band would name is the one
  // that is not a way in or a way out
  const cands = secs.filter((s2) => (Band.CHGROLE[s2] || s2) === r);
  return cands.find((s2) => s2 !== "intro" && s2 !== "outro") || cands[0] || r;
};
const qLabel = (who, id0) => {
  const id = id0.replace(/^ideaB?:/, "");
  if (id.startsWith("chg:")) {
    const r = id.slice(4), s2 = roleShown(r);
    return "the " + s2 + (s2 === r ? "" : "\u2019s") + " changes";
  }
  if (id.startsWith("len:")) return "how long the " + roleShown(id.slice(4)) + " runs";
  if (id.startsWith("lean:")) return "what leans in the " + roleShown(id.slice(5));
  return QLABEL[who + ":" + id] || QLABEL[id] ||
    id.replace(/^(knob|grp):/, "").replace(/:/g, " ");
};

/* ---------- THE OUTLINE --------------------------------------------------
   PLAN Phase 2: the answered facts used to render as one flat bunch of
   lozenges, which hid the one thing the vocabulary actually has — STRUCTURE.
   These tables say where every question of a seat LIVES in that structure:
   a heading bundles the questions that decide one thing (the record, the
   tune, the time, the form), and an UNDER edge nests a question below the
   answer it exists because of — the chorus's changes exist because the form
   has a chorus, the 303 panel exists because the bass is a synth, a pitched
   chair's bar exists because its job is rhythmic. The dependency edges are
   the vocabulary's own (question-trees walks the same ones); the tables
   only make them visible. A question neither table names still shows, in a
   trailing headless branch — the outline may not swallow a question. */
const OUTLINE = {
  arranger: [
    ["the record", ["when", "where", "venue", "genre"]],
    ["the tune", ["key", "mode", "mcolor", "chords", "knob:scale", "knob:diatonic"]],
    ["the time", ["tempo", "feel", "space"]],
    ["the form", ["form", "reprise", "doors", "arc", "chg:*", "lean:*",
                  "len:*", "end"]],
  ],
  drums: [
    ["the record's kit", ["groove", "the machine"]],
    ["the job", ["job"]],
    ["the time-keeping", ["time", "backbeat"]],
    ["the feel", ["loud", "loose", "knob:stress", "knob:kitProb"]],
    ["the fills", ["fills", "knob:fill", "the fills"]],
    ["at the kit", ["at the kit", "the kit", "take away", "the bar"]],
  ],
  bass: [
    ["the line", ["job", "the figure", "what notes it plays", "the bar"]],
    ["the instrument", ["instr", "what you are playing", "at the machine"]],
    ["the hands", ["sit", "notes", "reg"]],
  ],
  keys: [
    ["the instrument", ["instr"]],
    ["the job", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "atk", "rel", "col", "knob:phrase", "knob:maxHold"]],
  ],
  guitar: [
    ["the instrument", ["instr"]],
    ["the job", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "rel", "knob:orn"]],
  ],
  voice: [
    ["the voice", ["instr"]],
    ["the part", ["job", "the bar"]],
    ["the sound", ["reg", "cut", "atk"]],
  ],
  engineer: [
    // the drums block stays four questions (the gate taps its words); the
    // five channel questions read as one TABLE because the rows align —
    // channel down the label column, treatment beside it
    ["the drums", ["room", "kick", "snare", "hats"]],
    ["the space", ["verb", "delay"]],
    ["the glue", ["squeeze", "tape"]],
    ["the channels", ["keysfx", "gtrfx", "voxfx", "bassfx", "bassmix"]],
  ],
};
// the nesting edges, per seat: pattern -> the pattern of the row it sits
// under. Only real dependencies are drawn — a nest that is merely thematic
// would lie about the graph.
const UNDER = {
  // ...and the colour nests under the major/minor answer it refines
  arranger: { "chg:*": "form", "len:*": "form", mcolor: "mode",
              reprise: "form", doors: "form" },
  // ...named in both its costumes: the interview's row before it is
  // answered, the tray's subject ("what you are playing") after
  bass: { "at the machine": ["instr", "what you are playing"] },
  keys: { "the bar": "job" },
  guitar: { "the bar": "job" },
  voice: { "the bar": "job" },
  // the theme: the note-by-note bar exists over the rhythm you chose, and
  // "answer itself" — and the sentence — only exist once the tune is
  // longer than a bar. (Keys here are the SPEC's own patterns — the edge
  // is looked up by the pattern that placed the row, so a key spelled as a
  // label the spec never uses is an edge that never draws.)
  ideas: { "the bar": "cell", "the answer": "len", sent: "len" },
};
// a pattern names a question by id or by its label (a tray subject's label
// IS its group name); a trailing * is a prefix — the per-role calls the
// form unlocks are chg:verse, chg:chorus… — and a theme's questions wear
// their theme's spelling ("idea:len", "ideaB:len") while the node's
// patterns say the bare word, so a pattern matches through the costume.
// Without that strip the five interview rows never matched anything and
// fell to the trailing headless branch below the theme's own node, and
// UNDER.ideas' edges ("the bar" nests under "cell") were dead as written.
const outMatch = (p, d) => (p.endsWith("*") ? d.id.startsWith(p.slice(0, -1))
  : d.id === p || d.label === p || d.id.replace(/^ideaB?:/, "") === p);

// ONE SURFACE, THREE KINDS OF QUESTION, AND NO MENU. The seat you are in
// is asked its own questions in order; an answered one lands on the GIG
// SHEET and stays tappable, so changing your mind is tapping what you
// said. Rendered into whichever area owns the floor right now.
// `quiet` — the sheet without its floor question: the front door is asking
// the arranger's next question at the top of the page, and two questions on
// one page answer each other. Every fact still renders (a returning session's
// answers are the record so far); only the fieldset is withheld.
function chairArea(parent, who, ideasOnly, quiet) {
  // this seat's questions: the interview, then one per subject of whatever
  // words the player still has
  const groups = new Map();
  const byId = new Map();                    // the whole vocabulary, for the grid
  // THE DRUMMER'S BAR IS LANE-SCOPED (drums-kit stepsFor lives outside V),
  // so the laneless catalog never carries it. Fetch the pinned lane's own
  // vocabulary — the drum the mark row has in hand — through drums-kit's
  // catalog, exactly as the drums page drives the laneful bar: the count
  // grid, the step ids and say()/says() are all the kit's own.
  const laneNow = who === "drums"
    ? marksOf(who)[Math.min(barMarks.get(who) || 0, Band.D.LANES.length - 1)].lane
    : null;
  const cat = laneNow
    ? [...catalog(model, who), ...Band.D.catalog(model.drums, laneNow)]
    : catalog(model, who);
  for (const i of cat) {
    byId.set(i.id, i);
    if (i.group === "start") continue;
    if (MERGED.has(i.group)) continue;       // absorbed into the bar's marks
    // the arranger's tray IS the theme's vocabulary (catalog(m,"arranger")
    // returns the ideas words and nothing else), so in the SONG area those
    // subjects would be the themes questions asked a second time in a
    // second place — the outline made that duplication visible, and the
    // fix is the COVERS law's own: one home per question. They render in
    // the themes area, where the idea interview covers and dedupes them.
    if (who === "arranger" && !ideasOnly) continue;
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
  // (the ideas ids cover BOTH themes' spellings — the answer's interview
  // wears "ideaB:" and asks the same five-or-six things)
  const COVERS = { "the register": ["reg", "idea:reg", "ideaB:reg"], "the feel": ["sit"],
                   "the tempo": ["tempo"], "how you play them": ["notes"],
                   "the line": ["job"], "what you are playing": ["instr"],
                   "the rhythm of it": ["idea:cell", "ideaB:cell"],
                   "the shape": ["idea:contour", "ideaB:contour"],
                   "how it speaks": ["idea:sent", "ideaB:sent"],
                   "where it lands": ["idea:land", "ideaB:land"],
                   "how long": ["idea:len", "ideaB:len"] };
  // ...and a subject the ARRANGER owns is not a subject a player has. The
  // interview already drops those questions (TAKEN); the tray was still
  // handing the bassist "faster"/"slower" and the drummer the feel.
  const NOTYOURS = { drums: ["the tempo", "the feel"],
                     bass: ["the tempo", "the feel", "the key", "the changes"] };
  // the themes area shows the EDITED theme's questions (idea: for the tune,
  // ideaB: for the answer) plus the one question that decides whether an
  // answer exists at all; the song area shows neither — one home per
  // question, the COVERS law's own reason
  const ipfx = themeNow() === "b" ? "ideaB:" : "idea:";
  const asks0 = Band.asked(model, who)
    .filter((d) => (ideasOnly ? d.id.startsWith(ipfx) || d.id === "second"
                              : !d.id.startsWith("idea") && d.id !== "second"))
    // ONE HOME PER QUESTION (the COVERS law, one line down): while the front
    // door stands, when/where/the room are ITS rows. They come back to the
    // arranger's sheet — under "the record", where the outline puts them —
    // the moment a record is called and the door goes.
    .filter((d) => !(doorShut && who === "arranger" && !ideasOnly &&
                     (THREE.includes(d.id) || d.id === "genre")));
  const asked = new Set(asks0
    .flatMap(d => d.opts.map(o => o.w)));
  const asks = [
    // a fact says what it is, not what its id is: the ideas module prefixes
    // its questions so they can live in the arranger's chair, and nobody
    // needs to read "idea:len" on a gig sheet
    ...asks0.map(d => ({ id: d.id, ask: d.ask, label: qLabel(who, d.id),
      multi: !!d.multi,
      answered: d.answered, opts: d.opts.map(o => ({ w: o.w, row: o.row, on: o.answered,
        istrue: o.active, take: () => { model = answer(model, who, d.id, o.w); } })) })),
    ...[...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([g, list]) => ({
      id: "grp:" + g, ask: GROUPQ[g] || g, label: g,
      // the bar draws as the count grid; its cells live outside `opts` so a
      // word that needs a note first can GREY instead of vanishing
      bar: g === "the bar" && list.some(i => isCellId(i.id) && (i.changes || i.active)),
      answered: (list.find(i => i.active) || {}).words?.[0] || said.get("grp:" + g) || null,
      // A QUESTION NEVER OPENS WITH NOTHING YOU CAN TAP. Half the bass's
      // subjects are about a note that has to exist first — an octave on a
      // step with no note is not a word, it is a blank — so a word that
      // cannot be said and is not already true is not shown, and a subject
      // with nothing left in it is not asked ("when the octave setting first
      // shows up I can't select anything").
      opts: list.filter(i => (i.changes || i.active) && !asked.has(i.words[0]) &&
                             !(g === "the bar" && isCellId(i.id)))
        .map(i => ({ w: i.words[0], row: i.row,
        on: i.active || said.get("grp:" + g) === i.words[0],
        dead: false,
        take: () => {
          const line = says(model, who, i.id);
          const before = model;
          model = say(model, who, i.id);
          if (model !== before) ledger.push(line);
          said.set("grp:" + g, i.words[0]);
        } })) })),
  ].filter(d => (d.opts.length || d.bar) &&
    // COVERS/NOTYOURS are laws about tray SUBJECTS (a group whose question
    // an interview row already asks). An interview row wears a word of its
    // own for a label now, and must not be eaten for matching one.
    !(d.id.startsWith("grp:") &&
      ((COVERS[d.label] || []).some(id => asks0.some(x => x.id === id)) ||
       (NOTYOURS[who] || []).includes(d.label))));

  // NOTHING LEFT TO ASK IS NOTHING TO SAY. There is no line telling you to
  // tap something: everything on this page is already tappable, and a
  // sentence explaining that is the sentence a good surface does not need.
  // (A stale `asking` — a question the pruner has since retired — falls
  // back to the next unanswered question rather than an empty floor.)
  // Found FIRST so the outline can mark which of its rows holds the floor.
  // A RE-ASK WITH NOTHING TO CHANGE TO IS NOT A QUESTION: the pruner can
  // leave an answered interview fact exactly one option — its own answer —
  // and a button that opens a one-radio fieldset is a dead end in a
  // control's clothes. Such a fact renders as plain text and never takes
  // the floor.
  const flatFact = (d) => d.answered && !d.bar && !d.id.startsWith("grp:") &&
    d.opts.length < 2;
  const q = (asking && asks.find(d => d.id === asking && !flatFact(d))) ||
    asks.find(d => !d.answered);

  // THE GIG SHEET IS A TABLE PER HEADING. Every question of this seat is a
  // row — an answered one says its word, an open one says its ask — grouped
  // by the OUTLINE table above, fully expanded, nothing folded. A row is the
  // same tappable .dfact it always was (the gates find facts by the .dfact's
  // own textContent and its data-k, and both stay put); the one-question law
  // holds: tapping a row brings its question to the floor, and the floor is
  // IN PLACE — the fieldset opens in a row directly beneath that row (see
  // the end of this function), never at a fixed slot below the sheet, so at
  // most one set of options exists at any time.
  const spec = ideasOnly
    // the theme's node is titled by what the record DOES with the tune —
    // Band.themeName derives hook/riff/figure/chant, nobody is asked; when
    // the answer theme is in hand, its own name heads the node
    ? [[Band.themeName(model, themeNow() === "b" ? "b" : undefined),
        ["len", "cell", "sent", "the bar", "contour", "land", "reg",
         "the answer", "second"]]]
    : OUTLINE[who] || [];
  const under = (ideasOnly ? UNDER.ideas : UNDER[who]) || {};
  const rowTr = new Map();                     // ask id -> its <tr>, for the edges
  // THE ROW IS A NAME AND ITS VALUE: <th scope="row"> carries the control
  // that re-asks the question (a <button> in a <th> is valid, and the label
  // stays the thing you tap) plus the colon law's real ":", and the <td>
  // beside it carries the answer as plain text — or, unanswered, the
  // question itself, which IS what that name is worth so far. A fact the
  // pruner left with nothing to change to has no control at all: the name
  // is a plain word.
  const rowOf = (d) => {
    if (flatFact(d)) {
      const f2 = el("span", "dfact", d.label);
      f2.dataset.k = "fact|" + d.id;
      return trOf(f2, d.answered);
    }
    const c = el("button", "dfact" + (asking === d.id ? " open" : ""), d.label);
    c.type = "button";
    c.dataset.k = "fact|" + d.id;
    c.title = d.answered ? "change it: " + d.ask : d.ask;
    c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
    return trOf(c, d.answered || d.ask);
  };
  const placed = new Set();
  const branches = [];
  for (const [h, pats] of spec) {
    const list = [];
    for (const p of pats) for (const d of asks) {
      if (placed.has(d.id) || !outMatch(p, d)) continue;
      placed.add(d.id); list.push([p, d]);
    }
    if (list.length) branches.push([h, list]);
  }
  // whatever the tables do not name still shows — the outline may not
  // swallow a question the seat can be asked
  const rest = asks.filter(d => !placed.has(d.id)).map(d => [null, d]);
  if (rest.length) branches.push([null, rest]);
  // EVERY BRANCH IS A TABLE (2026-08-23). One table per heading — the
  // heading is its <caption> — and every question of that heading is one
  // row: the name in the <th>, its answer in the <td>. The engineer's
  // channel branch used to be the ONE table on the page, the shape everything
  // else was heading toward; now it is simply a branch like the others and
  // its special case is gone.
  //
  // ...AND THE DEPENDENCY EDGES ARE ORDER, NOT INDENT. A question that
  // exists because of another one (the chorus's changes because the form
  // has a chorus, the 303 panel because the bass is a synth) used to nest
  // in a <ul> inside its parent's <li>, three elements deep per edge. It is
  // the row immediately BELOW its parent now — same order, same reading,
  // no nesting and no hierarchy.
  const tables = [];
  for (const [h, list] of branches) {
    const head = h ? (ideasOnly ? themeNodeHead(themeNow(), true) : h) : null;
    const table = tableOf(head);
    const tail = new Map();                    // parent id -> its last child row
    for (const [pk0, d] of list) {
      const row = rowOf(d);
      rowTr.set(d.id, row);
      const pk = pk0 && under[pk0];
      const pks = !pk ? [] : Array.isArray(pk) ? pk : [pk];
      const pAsk = pks.length && asks.find(a => pks.some((x) => outMatch(x, a)));
      const pTr = pAsk && rowTr.get(pAsk.id);
      // the parent renders first (the tables order it so), so its row is
      // already in this table; several children keep their own order by
      // following the last one placed rather than the parent itself
      if (pTr && pTr.parentNode === table) {
        (tail.get(pAsk.id) || pTr).after(row);
        tail.set(pAsk.id, row);
      } else table.append(row);
    }
    tables.push(table);
    parent.append(table);
  }
  if (ideasOnly) {
    // THE SENTENCE, ITS OWN TABLE: it stands directly after the table that
    // holds the "how it speaks" row it visualizes — the sentence plan and
    // its measures in one place, side by side rather than one inside the
    // other — and falls back to after the theme's own table when the pruner
    // has retired that row (the strip may not vanish with it: a plain
    // sentence is still two measures the eye should see agree)
    const strip = sentStrip(themeOf(model, themeNow()) || model.idea);
    if (strip) {
      const sTr = rowTr.get((themeNow() === "b" ? "ideaB:" : "idea:") + "sent");
      const host = (sTr && sTr.parentNode) || tables[0];
      if (host) host.after(strip); else parent.append(strip);
    }
    // ...and the OTHER theme stands beside the edited one as a table of its
    // own — A above B, the record's own order, whichever is in hand — with
    // its name for a caption (the switch) and one line of what it is. Its
    // questions are not here: one home per question, and the home is the
    // node in the editing hand.
    if (model.ideaB && model.ideaB.on) {
      const other = themeNow() === "b" ? "a" : "b";
      const ot = tableOf(themeNodeHead(other, false));
      const om = themeOf(model, other);
      if (om) { const r = el("tr"); const td = el("td");
        td.textContent = Band.Id.describe(om); r.append(td); ot.append(r); }
      if (other === "a" && tables[0]) tables[0].before(ot); else parent.append(ot);
    }
  }
  if (asks.some(d => d.answered)) {
    // ...and one way back. A chair you cannot clear is a chair you stop
    // trying things in.
    const again = el("button", "dfact", "start over");
    again.type = "button";
    again.dataset.k = "again|" + who;
    again.title = "clear this chair and ask again";
    again.addEventListener("click", () => {
      model = Band.resetSeat(model, who);
      said.clear(); asking = null; push(false); announce(who, null); draw();
    });
    parent.append(again);
  }
  if (!q || quiet) return;
  floorQ = who + "|" + q.id + (ideasOnly ? "|ideas" : "");
  // a question and its answers are ONE form group — fieldset binds the
  // options to the legend, which stays the .dq the gates read. An interview
  // decision is one-of-N (radios); a grp: subject is a set of independent
  // toggles (checkboxes) — several of its words can be true at once
  const ask = el("fieldset", "dask");
  ask.append(el("legend", "dq", q.ask));
  // THE COUNT GRID. The bar renders as cells — columns one..four, rows the
  // beat/e/and/a — with the MARK row above it choosing what a tap puts
  // there. A cell's word is stepWord's own sentence, byte for byte.
  if (q.bar) {
    // THE BAR RAIL (PLAN.md THE THROUGH-COMPOSED THEME): a theme longer
    // than a bar aims its count grid — bar one · bar two · … — driving the
    // ideas kit's own `bar:` word. The grid below then shows the bar in
    // hand (the cell actives read the hand's grid), a written bar's key
    // says so in words, and a written bar in hand offers the way back.
    if (who === "arranger") {
      const theme = themeOf(model, themeNow()) || model.idea;
      const tbars = Band.Id.barsOf(theme);
      if (tbars > 1) {
        const wr = Band.Id.wroteOf(theme), hand = Band.Id.handOf(theme);
        // the words are the kit's own (Id.BARWORD) — the rail kept a copy of
        // four of them and a theme may be eight bars long since 2026-08-22
        const BW = Band.Id.BARWORD;
        const rail = el("p", "dbarrail", "bar ");
        for (let b = 0; b < tbars; b++) {
          const btn = el("button", "dmark" + (b === hand ? " on" : ""),
                         BW[b] + (wr[b] ? " · written" : ""));
          btn.type = "button";
          btn.dataset.k = "bar|" + who + "|" + b;
          btn.addEventListener("click", () => {
            const before = model;
            model = say(model, who, "bar:" + b);
            if (model !== before) push(false);
            draw(); });
          rail.append(btn, " ");
        }
        if (wr[hand]) {
          const back = el("button", "dmark dback", "let the plan have it back");
          back.type = "button";
          back.dataset.k = "bar|" + who + "|back";
          back.addEventListener("click", () => {
            model = say(model, who, "back:hand");
            push(false); announce(who, null); draw(); });
          rail.append(back);
        }
        ask.append(rail);
      }
    }
    const marks = marksOf(who);
    const mi = Math.min(barMarks.get(who) || 0, marks.length - 1);
    if (marks.length > 1) {
      const mrow = el("p", null, "put ");
      marks.forEach((mk, ix) => {
        const b = el("button", "dmark" + (ix === mi ? " on" : ""), mk.w);
        b.type = "button";
        b.dataset.k = "mark|" + who + "|" + mk.w;
        b.addEventListener("click", () => { barMarks.set(who, ix); draw(); });
        mrow.append(b, " ");
      });
      ask.append(mrow);
    }
    // THE BAR AS A REAL <table> (the basic-HTML reset): column heads
    // one..four, row heads the beat/e/and/a, and every cell the same
    // labeled checkbox it always was \u2014 class .dopt, the whole counted
    // sentence for its word (the contract), native checked state. The
    // gates' `.dgrid .dopt input` selector reads it unchanged.
    // ...and it is the bar THIS RECORD counts: four columns of four in four,
    // three of four in a waltz, six of two in a six-eight. Twelve cells either
    // way, one screen either way, and the same .dgrid/.dopt contract.
    const MT = metNow();
    const HEADS = MT ? MT.names : ["one", "two", "three", "four"];
    const NSUB = MT ? MT.count : 4;
    const grid = el("table", "dgrid");
    { const thr = el("tr");
      thr.append(el("th"));
      for (const c of HEADS) {
        const th = el("th", null, c); th.scope = "col"; thr.append(th);
      }
      const thead = el("thead"); thead.append(thr); grid.append(thead); }
    const gbody = el("tbody");
    const SUBS = NSUB === 2 ? ["\u00b7", "and"] : ["\u00b7", "e", "and", "a"];
    for (let sub = 0; sub < NSUB; sub++) {
      const gtr = el("tr");
      { const th = el("th", null, SUBS[sub]); th.scope = "row"; gtr.append(th); }
      for (let beat = 0; beat < HEADS.length; beat++) {
        const i = beat * NSUB + sub;
        const entry = byId.get(marks[mi].id(i));
        const on = !!(entry && entry.active);
        // everything past the note greys until a note exists at that place —
        // the kit's own when-guard made visible, never a vanished word
        const dead = !entry || (!entry.changes && !entry.active);
        // THE TIE SHOWS THROUGH EVERY MARK: a place the hand marked "hold
        // it" (the theme grid's 2) keeps its tie paint whichever mark is in
        // hand, so switching back to "the note" does not make the ties
        // vanish from the bar. Only the theme's vocabulary has tie: ids —
        // every other chair's grid is untouched.
        const tieE = byId.get("tie:" + i);
        const td = el("td");
        td.append(optWidget(stepWord(i), "dopt dcell" + (on ? " on" : "") +
                              (tieE && tieE.active ? " dtied" : ""), {
          kind: "checkbox", name: "bar-" + who, on, dead,
          key: "opt|" + who + "|grp:the bar|" + (entry ? entry.id : i),
          take: () => {
            if (!entry) return;
            const line = says(model, who, entry.id);
            const before = model;
            model = say(model, who, entry.id);
            if (model !== before) { ledger.push(line); push(false); announce(who, null); }
            said.set("grp:the bar", stepWord(i));
            draw();
          } }));
        gtr.append(td);
      }
      gbody.append(gtr);
    }
    grid.append(gbody);
    ask.append(grid);
  }
  // THE KEY IS A CIRCLE. "what key are we in?" draws as the object a
  // musician keeps in their head — the circle of fifths — instead of a
  // twelve-word pile (see keyCircle below). Same fieldset, same .dopt
  // radio-labels, same exact words; only the arrangement is round.
  if (q.id === "key" && who === "arranger") {
    ask.append(keyCircle(q, who));
  } else {
  // an interview decision marked `multi` (the engineer's channel
  // treatments) is a toggle set — several of its words lit at once
  const kind = q.id.startsWith("grp:") || q.multi ? "checkbox" : "radio";
  // LABELED ROWS, NOT WORD-PILES: when every option names its row (the
  // kick:, the filter:, pianos:…), the options group under those labels in
  // the order a musician lists them, each label a plain <p> in the flow
  let opts2 = q.opts;
  const rowed = opts2.length > 0 && opts2.every(o => o.row);
  if (rowed) {
    const at = (r) => { const ix = ROWORDER.indexOf(r); return ix < 0 ? ROWORDER.length : ix; };
    opts2 = [...opts2].sort((a, b) => at(a.row) - at(b.row));
  }
  const fire = (o) => () => {
    const before = model;
    o.take();
    if (model !== before) { push(false); announce(who, null); }
    // a checkbox set stays on the floor — lighting one treatment is not
    // the end of the question the way choosing a radio is
    asking = q.multi ? q.id : null;
    draw();
  };
  // every option is a child of the fieldset itself; a row label is a plain
  // <p> in the same flow (no grid, no wrapper)
  let lastRow = null;
  for (const o of opts2) {
    if (rowed && o.row !== lastRow) { ask.append(el("p", null, o.row)); lastRow = o.row; }
    ask.append(optWidget(o.w, "dopt" + (o.on ? " on" : "") +
                               (!o.on && o.istrue ? " istrue" : ""), {
      kind, name: "q-" + who + "-" + q.id, on: o.on, dead: o.dead,
      key: "opt|" + who + "|" + q.id + "|" + o.w,
      take: fire(o) }), " ");
  }
  }
  // THE ESCAPE IS A WIDGET OF THE QUESTION, not an option (the keyCircle
  // law: the circle is a rendering of the key question). A `chg:<role>`
  // fieldset carries its catalog radios PLUS the picker — "changes of our
  // own…" — because an "other changes" ANSWER would materialize the current
  // roots, be secSig-identical, and be rightly pruned.
  if (who === "arranger" && q.id.startsWith("chg:"))
    ask.append(chgxWidget(q.id.slice(4)));
  // THE RECORD'S LENGTH IS A FACT, NOT A QUESTION: the form × the lengths
  // already decide it, so the form node simply says what they add up to
  if (q.id === "form") {
    const song = toSong(model, MODES);
    const bars = song.reduce((n, s2) => n + s2.bars, 0);
    const secs = Math.round(bars * 4 * 60 / (model.song.bpm || 96));
    ask.append(el("p", null, "that\u2019s " + Math.floor(secs / 60) + ":" +
                               String(secs % 60).padStart(2, "0")));
  }
  // INLINE, IN PLACE (2026-08-21). The question used to land at a fixed
  // slot below the whole sheet; it opens AT ITS ROW now — the sheet expands
  // at that row and the page grows vertically. Every ask has a row (the
  // trailing headless branch catches whatever the tables do not name), and
  // the fieldset lands in a row of its own directly beneath, spanning both
  // columns, above any rows that depend on this one.
  const qTr = rowTr.get(q.id);
  if (qTr) askRow(qTr, ask); else parent.append(ask);
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
  "the kit": "what’s in the kit?",
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
// empty, so the next record can begin from "when is it?" rather than
// from whatever the last one decided.
$("dreset").addEventListener("click", () => {
  model = { ...Band.opening(), on: true };
  said.clear(); asking = null; section = null; picker = null; adding = false;
  pverb = null; psubj = null;
  module_ = "song"; seat = "drums";
  ledger.length = 0;
  clearMixOffsets();
  try { localStorage.removeItem(SAVE); } catch (e) {}
  // ...AND IT PLAYS. "Start again" used to stop the band and hand you an
  // empty room; it hands you the record the room opens with, and a record
  // you have to press play to hear is a record nobody hears. Same three
  // lines as the dice, for the same reason — a whole record landing sets
  // `settling`, which holds the auto-start off.
  push(true); draw();
  if (!playing) startAt(0);
  playWord(true);
});
// THE DICE — a whole record by answering every question at random, which is
// only possible because the graph is complete: every question has at least
// two answers and none of them leads anywhere unplayable. It is the ordinary
// path taken quickly, not a special one.
$("ddice").addEventListener("click", () => {
  model = Band.randomSong();
  said.clear(); asking = null; section = null; picker = null; adding = false;
  pverb = null; psubj = null;
  module_ = "song";
  ledger.length = 0;
  clearMixOffsets();
  push(true); draw();
  if (!playing) startAt(0);
  playWord(true);
});
// ANOTHER TAKE — the same record, played again. NOT the dice: the dice
// answers every question afresh and throws the identity away; this holds
// every answered fact (when, where, the record, the key, the tempo, the
// form and its lengths, every chair's answers, every producer note, every
// bar of the theme a hand wrote) and moves the one number the KERNEL draws
// its performance from (band-kit `anotherTake` -> `song.take` -> `kitSeed`).
// So the band plays the same tune again and plays it differently: the hand
// moves, the velocities move, the ornaments fall elsewhere, a canon lands
// somewhere else. Measured over 60 records: 12.7% of the notes land
// somewhere else, the timing moves on 63% of the ones both takes have and
// the velocity on 57%, and every answered field is byte-identical.
// The take is on the MODEL, so it is saved with the session and a record
// stays a document: the same take is the same performance, always.
$("dtake").addEventListener("click", () => {
  const next = Band.anotherTake(model);
  if (next === model) return;
  model = next;
  // nothing else is cleared: the ledger, the chair, the section in hand and
  // the producer's stack all belong to the record, and this is the record.
  push(true); draw();
  if (!playing) startAt(0);
  playWord(true);
});
$("dplay").addEventListener("click", () => {
  if (playing) { stop(); playWord(); }
  else {
    // ...and PLAY COUNTS THE BAND IN TOO. `on` used to gate this key, which
    // meant that on a first visit — the one state where it is false — the
    // transport's own play button did nothing at all. There is a record
    // standing in the room from the first paint (the demonstration record);
    // the key that says play should play it.
    // (no push: the record has been in SONG/GENRES since boot — `on` is what
    // ARMS the page, not what compiles it, and pushing here would start the
    // engine a second time through the `armed` hook)
    if (!model.on) { model = { ...model, on: true }; draw(); }
    startAt(0); playWord(true);
  }
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

/* ---------- the volume ---------- */
// THE LISTENER'S KNOB (Paul: "I need a volume slider on the top very
// badly"). A plain <input type=range> over the DEVICE volume — ui/state.js
// setVol writes VOLSTORE ("nukernel.vol.v1"), the same setting the daw's
// fader keeps — never the engineer's desk: those answers are mix OFFSETS on
// the voices, this is the master the parent engine smooths on the audio
// thread, and the two must not fight. audio/live.js already rides the value
// both ways: `masterVol: vol / 100` when the engine opens (so a level set
// before the first play is the level the first bar sounds at) and
// handle.setMasterVol on every "transport" commit (so a drag mid-bar is
// heard mid-bar). A fresh device starts at FULL: the store's own default
// (80) predates this knob being visible anywhere on this page, and a knob
// that boots at four-fifths looks broken; a device that has ever set a
// level keeps it.
try { if (localStorage.getItem("nukernel.vol.v1") == null) setVol(100); } catch (e) {}
{
  const volEl = $("dvol");
  if (volEl) {
    volEl.value = String(vol);
    volEl.addEventListener("input", () => { setVol(+volEl.value); commit("transport"); });
  }
}

/* ---------- the beat counter and the change countdown ---------- */
// PLAN Phase 1a: the transport SAYS where it is (bar.beat) and WHEN a change
// just made will be heard ("the bass — changes in 8 beats… 7…"). Both are
// plain text off the engine's own feeds — audio/live.js emits "pos" once per
// beat and "pending" once per count — so this is rendering, not timekeeping.
const beatEl = $("dbeat"), pendEl = $("dpending"), liveEl = $("dlive");
const pend = new Map();                       // label -> the last "pending" payload
on("pos", (d) => {
  beatEl.textContent = "bar " + (d.bar + 1) + "." + d.beat;
  lightBeat(d);
});

// THE BAND LIGHTS THE STAFF. Driven by the same per-beat "pos" feed the
// counter reads — no rAF, no loop of its own. Each beat: is the sounding
// section carrying a theme (partOf's taker — the defaults included, so the
// chorus's own hook lights unsaid), WHICH theme (per.theme "b" rides B's
// staff), and where in the theme's own cycle the ear is — the melody layer
// rides its own phrase length as the bar (band-kit's per16), so a two-bar
// theme under a four-bar section cycles twice: position is
// (barInSection × 16 + stepInBar) mod the phrase's steps, off passAt's own
// bar-within-box. A beat is four sixteenths, so up to three timers a beat
// carry the lights BETWEEN pos events; they are cleared on every beat and
// on stop, and lightStaff itself no-ops until the index changes. The staff
// draws the theme as the ROOM owns it, so that is the timeline lit — a
// section's return transform (augmented, just its head) reshapes the sound,
// not the notation. The piano audition outranks the band on the staff: it
// is the surface's own instrument, lighting from its own timers.
let lightTimers = [];
const clearLightTimers = () => { for (const t2 of lightTimers) clearTimeout(t2);
  lightTimers = []; };
const themeNoteAt = (tn, step) => {
  for (let k = 0; k < tn.notes.length; k++) {
    const x = tn.notes[k];
    if (x.at > step) break;
    if (step < x.at + x.len) return k;
  }
  return -1;                                  // a rest: nothing in the air
};
function lightBeat(d) {
  clearLightTimers();
  if (auditioning()) return;                  // the piano has the staff
  if (!playing || !(model.idea && model.idea.on) || d.si == null || d.si < 0) {
    dressStaff(null, null, "", "");
    return lightStaff(null, null);
  }
  const per = Band.partOf(model, d.si);
  const tk = Band.TAKERS[per.idea];
  const role = Band.secsOf(model)[d.si] || "section";
  // NOBODY IS PLAYING THE TUNE HERE, AND THE PAGE SAYS SO. A dark staff and
  // an honest sentence look identical from across the room, and this record
  // spends whole sections with the melody out; the words are the difference
  // between "the tune is out" and "the lights are broken".
  if (!tk || !tk.chair) {
    dressStaff(null, null, "", "the tune is out in the " + role);
    return lightStaff(null, null);
  }
  const t = per.theme === "b" && model.ideaB && model.ideaB.on ? "b" : "a";
  // AS PLAYED: the section's own notes, off the compiled score. When the
  // layer never reached the timeline (a compile between records, a section
  // whose taker has no room) the written staff stands, which is the honest
  // fallback — it is still this theme.
  const bw = backWord(per.back);
  const eng = dressStaff(d.si, t, "as played in the " + role +
                         (per.back && per.back !== "same" ? ": " + bw : ""),
                         "as written");
  const tn = eng || toNotes(Band.Id.toPhrase(themeOf(model, t)), themeOpts(model, t));
  if (!tn.n || !tn.notes.length) return lightStaff(null, null);
  let barIn = 0;                              // which bar of the sounding box
  try { barIn = Math.max(0, (passAt(getPosition().now).bar || 1) - 1); }
  catch (e) {}
  const step0 = (barIn * tn.spb + Math.max(0, (d.beat || 1) - 1) * 4) % tn.n;
  const stepSec = 60 / Math.max(30, d.bpm || model.song.bpm || 96) / 4;
  let prev = null;
  for (let sub = 0; sub < 4; sub++) {
    const idx = themeNoteAt(tn, (step0 + sub) % tn.n);
    if (sub === 0) { lightStaff(t, idx); prev = idx; }
    else if (idx !== prev) {
      prev = idx;
      lightTimers.push(setTimeout(() => {
        if (playing && !auditioning()) lightStaff(t, idx);
      }, sub * stepSec * 1000));
    }
  }
}
// SPEAK LIKE A MUSICIAN, NOT A LOG. "the melody in the drop — changes in 21
// beats; the drums in the drop — changes in 21 beats" was true and unreadable:
// the big number was left to explain, by itself, that the drop is far away.
// So a section-scoped landing SAYS WHY ("the drums change when the drop comes
// round — 21", off the feed's own `round`), an imminent one just counts ("the
// melody changes in 5"), everything landing on the SAME bar is one sentence,
// lines run soonest first, at most two, and the rest is "+ n more waiting".
const pluralish = (w) => { const t = w.split(" ").pop();
  return t.length > 1 && t.slice(-1) === "s" && t !== "bass"; };
function pendPhrase(names, d) {
  const subj = names.length === 1 ? names[0]
    : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  const verb = (names.length > 1 || pluralish(subj)) ? "change" : "changes";
  return d.round && d.role
    ? subj + " " + verb + " when the " + d.role + " comes round — " + d.beatsLeft
    : subj + " " + verb + " in " + d.beatsLeft;
}
function drawPending() {
  const at = new Map();                       // landsSerial -> one line's facts
  for (const p of pend.values()) {
    const g = at.get(p.landsSerial) ||
      { s: p.landsSerial, names: [], beatsLeft: p.beatsLeft, round: false, role: null };
    if (g.names.indexOf(p.who || p.label) < 0) g.names.push(p.who || p.label);
    g.beatsLeft = Math.min(g.beatsLeft, p.beatsLeft);
    if (p.round && !g.round) { g.round = true; g.role = p.role; }
    at.set(p.landsSerial, g);
  }
  const lines = [...at.values()].sort((a, b) => a.s - b.s);
  pendEl.textContent = "";
  for (const g of lines.slice(0, 2))
    pendEl.append(el("div", null, pendPhrase(g.names, g)));
  if (lines.length > 2)
    pendEl.append(el("div", null, "+ " + (lines.length - 2) + " more waiting"));
}
on("pending", (d) => {
  // beatsLeft 0 is the landing: the change is in the air, so the line goes
  if (d.beatsLeft === 0) pend.delete(d.label);
  else {
    // ...and a screen reader hears each promise ONCE, when its label first
    // appears: one polite write per new label, never per beat tick — the
    // ticking stays in #dpending, which is not live on purpose
    if (!pend.has(d.label) && liveEl)
      liveEl.textContent = pendPhrase([d.who || d.label], d);
    pend.set(d.label, d);
  }
  drawPending();
});
on("transport:state", () => {
  if (!playing) { pend.clear(); beatEl.textContent = ""; pendEl.textContent = "";
    if (liveEl) liveEl.textContent = "";
    clearLightTimers();
    // STOPPED, SO THE STAFF GOES BACK TO THE COMPOSER'S VIEW: the theme as
    // written, with nothing claiming it is being played
    if (!auditioning()) { dressStaff(null, null, "", ""); lightStaff(null, null); } }
});

/* ---------- boot ---------- */
// the gate reads tempo as part of the artifact — the tempo the ENGINE is
// handed, which is the producer's if a note moved it and the arranger's
// otherwise (with no notes the two are the same number)
window.__nuTempo = () => produced(model).bpm;
// ...and what the producer has been told, and what it says it did. A gate
// asking "did the sentence move the record" has to read the ARTIFACT.
window.__bandProd = () => { const r = produced(model);
  return { notes: Prod.notesOf(model), mix: r.mix, bpm: r.bpm,
           said: r.said.map((x) => ({ sentence: x.sentence, w: x.note.w,
                                      said: x.said, moved: x.moved })) }; };
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
    // THE METER IS RE-SEATED FROM THE WORD, never trusted off the wire. A
    // saved session carries `song.meter` (one of the two words fields.js
    // METERLABEL names, or nothing); the two NUMBERS every chair counts by
    // are looked up fresh from the live table, so a tampered or stale `met`
    // on a chair cannot outlive the word that made it.
    model = Band.seatMeter(model, Band.metOf(model.song));
    return true;
  } catch (e) { return false; }
}

registerSW();
warmShell();
window.__bandWarm = () => warmed();               // the gate asks what is cached
window.__bandDraw = () => draw();                  // the gate times a redraw
window.__bandLit = () => ({ t: litT, idx: litIdx });  // the lit staff note
// ...and WHAT THE STAFF IS SHOWING: which theme (if any) stands re-engraved
// from the sounding section's own notes, that engraving's timeline, and the
// words under each staff. A gate asking "does the page draw what it plays"
// has to read the ARTIFACT, not the model that would have made it.
window.__bandStaff = () => ({
  sig: staffSig, si: playedSi,
  played: Object.fromEntries(Object.entries(playedEng).map(([k, e]) =>
    [k, e.notes.map((x) => ({ at: x.at, len: x.len, midi: x.midi }))])),
  cue: { a: (staffCue.a || {}).textContent || "", b: (staffCue.b || {}).textContent || "" },
  abc: { a: staffAbc.a || "", b: staffAbc.b || "" },
  // ...and the ENGRAVING itself: which octave the staff is written in (8va /
  // 8vb / as it sounds), whether any octave rescued it, the glyph -> note map
  // the lights ride, and the sounding midi of every note. A gate proving that
  // the drawn note IS the played note, moved by the marked octave and nothing
  // else, needs all four and can derive none of them.
  eng: Object.fromEntries(["a", "b"].filter((k) => staffEng[k]).map((k) => [k, {
    ottava: staffEng[k].ottava | 0, wide: !!staffEng[k].wide,
    glyphs: staffEng[k].glyphs.slice(),
    notes: staffEng[k].notes.map((x) => ({ at: x.at, len: x.len, midi: x.midi })),
  }])),
});
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
