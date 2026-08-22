// nukernel/ui/band.js — THE BAND: an arranger and two players. One page, one URL,
// no navigation and no grid: the pattern exists only as the words that made
// it. Everything sounding is the parent engine (FaustLive) through the same
// audio tier the daw uses — one engine, still.
// the kit model is the classic UMD data tier (nukernel/drums-kit.js), read
// off window exactly as ui/deps.js reads the rest of it
const Band = window.NuBand;
const { blank, catalog: catalog0, say: say0, says: says0, toSong, seatDecisions,
        nextAsk, nextAnywhere, answer, SEATS, sectionAsks, setSection } = Band;
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
import { adoptSong, SONG, SLOTS, putPhrase, on, commit, setBpm, setSwing, setPoolChair,
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
  setBpm(model.song.bpm);
  setSwing(model.song.swing || null);
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
  clearMixOffsets();
  for (const [chan, vals] of Object.entries(Band.mixOf(model)))
    for (const [k, v] of Object.entries(vals)) setMixOffset(chan, k, v);
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
});
function playedPhrase(si) {
  const TL = timeline();
  if (!TL.length || si == null || si < 0) return null;
  const lay = MELP + si, sec = SONG[si];
  if (!sec || !GENRES[lay]) return null;
  const ent = (sec.stack || []).find((e) => e.g === lay);
  const ph = ent && SLOTS[ent.slots[0]];
  if (!ph || !ph.gate || !ph.gate.length) return null;
  const cyc = Math.max(1, Math.round(ph.gate.length / 16));   // the theme's own bars
  const n = cyc * 16;
  const gate = new Array(n).fill(0), midi = new Array(n).fill(0),
        hold = new Array(n).fill(0);
  let any = false;
  for (const bar of TL) {
    const bi = bar.barIn || 0;
    if (bar.si !== si || bi >= cyc) continue;
    // the NOMINAL grid (bar.steps), because `off` was written on it: the
    // tempo map warps barSteps afterwards and a staff has no rubato
    const rate = 16 / (bar.steps || 16);
    for (const e of bar.ev) {
      if (e.layer !== lay || e.kind !== "line" || e.n == null) continue;
      const at = bi * 16 + Math.max(0, Math.min(15, Math.round((e.off || 0) * rate)));
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
function setCue(t, words) {
  cueWord[t] = words || "";
  if (staffCue[t]) staffCue[t].textContent = cueWord[t];
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
  staffCue[t].textContent = cueWord[t] || "";
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
    delete staffCue.a; delete staffCue.b;
    staffAbc.a = staffAbc.b = ""; staffDone.a = staffDone.b = "";
    playedEng = {}; playedSi = null; staffSig = "";
    cueWord.a = cueWord.b = "";
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
         staffAbc.b = ""; staffDone.b = ""; delete playedEng.b; staffSig = "";
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
  if (!(model.ideaB && model.ideaB.on)) return el("span", "dthead", name);
  const b = el("button", "dthead dtnode" + (edited ? " on" : ""), name);
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
  const NN = ph.gate.length, N16 = 16;
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
  const wrap = el("ul");
  for (let b = 0; b < bars; b++) {
    const row = el("li", "dsentbar");
    // PLAIN TEXT ROWS (the basic-HTML reset): one measure per line, sixteen
    // characters — x a note starting, - the note still sounding through
    // (the tie made visible; a - opening the next row IS the tie over the
    // barline), · a rest — a space at each beat so the bar counts itself.
    let txt = "";
    for (let i = 0; i < N16; i++) {
      const v = state[b * N16 + i];
      txt += v === 1 ? "x" : v === 2 ? "-" : "·";
      if (i % 4 === 3 && i < 15) txt += " ";
    }
    const cellsEl = el("span", "dsentcells", txt);
    const word = wr[b] ? "written by hand"
      : rowOf ? (ROLEW[rowOf[b]] || rowOf[b]) : (b ? "the cell again" : "says it");
    const aim = el("button", "dsentrole" + (wr[b] ? " dwr" : ""), word);
    aim.type = "button";
    aim.dataset.k = "sbar|" + b;
    aim.addEventListener("click", () => {
      model = say(model, "arranger", "bar:" + b);
      module_ = "ideas"; section = null; asking = "grp:the bar";
      push(false); draw(); });
    row.append(cellsEl, " ", aim);
    wrap.append(row);
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

// the heading-word of an area, as a button: tap "themes"/"song"/"band" and
// that area's next question comes to the floor
function modButton(word, key) {
  const b = el("button", "dmod" + (module_ === key ? " on" : ""), word);
  b.type = "button";
  b.dataset.k = "mod|" + key;
  b.addEventListener("click", () => {
    module_ = key; section = null; asking = null; picker = null; draw(); });
  return b;
}

// NAV AND FOLDS (2026-08-21, Paul: "instead of using only lists use HTML
// <nav> elements to make things easy to hide and shrink"). The outline
// trees ARE this page's navigation — the tree is how the floor moves — so
// each one stands inside a labeled <nav> landmark; and the regions that
// should hide and shrink do it with the browser's own <details>/<summary>,
// no JS collapse of its own: an area under its heading, the open chair's
// sheet under its seat line, a headed branch under its head. Everything is
// OPEN by default (the outline's "expanded, always" law — and the gates
// walk today's DOM), but now closable; a fold the hand shut stays shut
// across redraws (the `closed` set remembers, since draw() rebuilds the
// page). A button inside a summary keeps its own job: the guard below
// cancels the native toggle when the click landed on a control, so tapping
// "song" still brings its questions to the floor rather than folding the
// area you were reaching into.
const closed = new Set();          // fold keys the hand has shut
function navOf(inner, label) {
  const n = el("nav");
  if (label) n.setAttribute("aria-label", label);
  n.append(inner);
  return n;
}
function foldOf(key, sumLine) {
  const det = el("details");
  if (!closed.has(key)) det.open = true;
  const sum = el("summary");
  sum.addEventListener("click", (e) => {
    if (e.target.closest("button,label,input,select")) return e.preventDefault();
    // the native toggle is about to flip det.open — remember the hand's
    // choice NOW (the "toggle" event is queued async, and a redraw in this
    // same task would otherwise rebuild the fold open again)
    if (det.open) closed.add(key); else closed.delete(key);
  });
  sum.append(sumLine);
  det.append(sum);
  // ...and the async event keeps the set honest for keyboard toggles and
  // anything else that moves `open` without the click above
  det.addEventListener("toggle", () => {
    if (det.open) closed.delete(key); else closed.add(key);
  });
  return det;
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

// A LONG LIST IS A GRID OF RADIOS (2026-08-21, Paul: "don't use dropdown
// select boxes just have a nice grid of radio buttons" — reversing the
// reset's <select> ruling). Any one-of-N question over ~8 answers renders
// the SAME plain radio-labels every short question gets, laid out in
// aligned columns by band.css .dcols (an auto-fill grid — layout, not
// decoration) so 14–30 options scan instead of piling. Row labels (the
// kick:, pianos:…) stand as plain full-width .drowlab rows inside the
// grid, the .drowlab precedent the short path always drew. There is no
// <select> anywhere on the page — the gates' tap helper still knows how
// to drive one (harmless), but nothing renders one. Toggle sets stay
// checkboxes, and the key question stays the circle of fifths (Paul:
// "Keep the circle of fifths!!!").
const LONG = 8;

// A FACT IS A NAME AND ITS VALUE — so it is a <dl> (2026-08-22, the
// cleanliness pass). Every answered line of the gig sheet used to be a
// <button> holding a <b> label, a colon and a .dans <span>: a label→value
// pair wearing generic elements. It is a real one-pair definition list
// now — the TERM is the control that re-asks the question, the
// DEFINITION is the answer (or, unanswered, the question itself) in plain
// text — which is what makes the pairing something a screen reader can
// hear without a hidden word helping it. No .dans, no .dhint, no <b>.
//
// THE COLON LAW (2026-08-21, Paul: "just put a colon on things, like
// verse: 4 sections or tempo: up, 120") survives inside it: the seam is a
// real ":" text node, never CSS content, so it reads with the stylesheet
// off and is spoken. It sits in the <dt> AFTER the control, so the
// .dfact element's own textContent stays the label exactly — which is
// how the gates find a fact, and how a value with commas in it
// ("tempo: up, 120") still reads as one answer.
const term = (labelEl) => { const dt = el("dt"); dt.append(labelEl, ":"); return dt; };

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
  // one row per CHORD, bars numbered, a split bar's second chord indented
  const flat = [];
  list.forEach((bar, bi) => bar.forEach((cc, ki) => flat.push({ cc, bi, ki })));
  flat.forEach(({ cc, bi, ki }, ci) => {
    // a bar and its chord is the same name/value pair the gig sheet reads
    // as a <dl>: the tappable bar number is the term, the chord the value
    const rowB = el("button", "dfact dpickbar" + (picker.open === ci ? " open" : ""),
                    ki ? "and" : "bar " + (bi + 1));
    rowB.type = "button";
    rowB.dataset.k = "pbar|" + role + "|" + ci;
    rowB.addEventListener("click", () => {
      picker.open = picker.open === ci ? null : ci; draw(); });
    const dl = el("dl");
    dl.append(term(rowB), el("dd", null, chordWord(cc)));
    wrap.append(dl);
    if (picker.open !== ci) return;
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
    wrap.append(circle);
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
    wrap.append(qrow);
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
  // TAP AWAY FROM ANYTHING. Nothing here has to be dismissed: tapping the
  // floor closes whatever is open (a section being arranged, a fact being
  // changed), and tapping another thing just opens that one instead.
  box.onclick = (e) => {
    if (e.target !== box) return;
    if (asking == null && section == null && picker == null) return;
    asking = null; section = null; picker = null; draw();
  };

  // BEFORE THE COUNT-IN there is nothing to arrange: one sentence and one
  // word. The three areas appear when the band exists.
  if (!model.on) {
    const start = el("section");
    start.append(el("p", "dprose",
      "A band: an arranger, a drummer, a bass player, keys, a guitar, a " +
      "voice and an engineer. Count it in and answer what it asks."));
    const c = el("button", "dchip", "count it in");
    c.type = "button";
    c.dataset.k = "start";
    c.addEventListener("click", () => {
      model = { ...model, on: true };
      ledger.push("a band, waiting to be told what the tune is");
      push(true); draw(); });
    start.append(c);
    box.append(start);
    return;
  }

  // ---- THEMES ---- (the ideas module by its right name — PLAN Phase 2
  // renames the organ; the page starts saying the word now)
  const sThemes = el("section");
  // the whole area folds under its heading (foldOf's law) — hideable,
  // shrinkable, open by default
  const dThemes = (() => { const h = el("h2");
    h.append(modButton("themes", "ideas")); return foldOf("area|themes", h); })();
  sThemes.append(dThemes);
  // NO PROSE (2026-08-21). Two paragraphs used to explain what a theme is
  // and how to add one — "don't sneak in explanations". The outline IS the
  // explanation: the staff, the theme's own named node, and its questions.
  // The theme itself, written down: the staff stands whenever the record
  // has the tune, and follows every edit — a lifted note, a new key —
  // because draw() recompiles the ABC each pass and re-engraves on change
  const staff = themeStaff(model);
  if (staff) dThemes.append(staff);
  if (module_ === "ideas" && section == null) chairArea(dThemes, "arranger", true);
  box.append(sThemes, el("hr"));

  // ---- SONG ---- the record's structure AS AN OUTLINE (2026-08-21): the
  // sections were the page's one remaining bunched row of boxes; they are
  // nodes of a .dtree now, like everything else — each section a row (its
  // label the role and the bars, the same .dsec button the gates click and
  // the playhead lights), the open section's asks nested BENEATH its own
  // node inline, and "add a box" a plain row at the end.
  const sSong = el("section");
  const dSong = (() => { const h = el("h2");
    h.append(modButton("song", "song")); return foldOf("area|song", h); })();
  sSong.append(dSong);
  const song = toSong(model, MODES);
  const tree = el("ul", "dtree dsong");
  cells = [];
  song.forEach((s2, i) => {
    cells[i] = [[]];
    const li = el("li");
    const b = el("button", "dsec" + (section === i ? " open" : ""));
    b.type = "button";
    b.dataset.k = "sec|" + i;
    b.title = "what is everyone doing here?";
    // the box's name reads by the colon law ("head: 4 bars"), the extra
    // words comma-joined after it — one plain string, since a <b> for the
    // role and an <i> for the bars were paint over a sentence — and the
    // hint the title used to hoard is words in the name too: .dvh, text AT
    // can reach, invisible.
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
    li.append(b);
    // the open section's whole conversation, nested under its own node —
    // the same in-place mechanism the chairs use
    if (section === i) sectionArea(li);
    tree.append(li);
  });
  // A BOX IS A SECTION OF THE SONG, and today every box comes from the FORM
  // — there is no per-box append in the model yet, so "add a box" honestly
  // opens the question that decides how many boxes the record has and what
  // each one is. A plain row at the end of the outline.
  { const li = el("li");
    const add = el("button", "dadd", "add a box");
    add.type = "button";
    add.dataset.k = "addbox";
    add.title = "boxes come from the form — open that question";
    add.addEventListener("click", () => {
      module_ = "song"; section = null; asking = "form"; draw(); });
    li.append(add);
    tree.append(li); }
  // the song's outline is the way around the record: a landmark
  dSong.append(navOf(tree, "the song's sections"));
  if (section == null && module_ === "song") chairArea(dSong, "arranger", false);
  box.append(sSong, el("hr"));

  // ---- THE BAND ---- the members, each a plain block that says how much
  // it still has to decide. Tap one and its questions take the floor.
  const sBand = el("section");
  const dBand = (() => { const h = el("h2");
    // the visible heading reads "the band"; the button inside it is the
    // word the gates (and a finger) press — but its accessible NAME is the
    // heading's whole phrase: "band" alone is not a thing on this page
    const mb = modButton("band", "band");
    mb.setAttribute("aria-label", "the band");
    h.append(document.createTextNode("the "), mb);
    return foldOf("area|band", h); })();
  sBand.append(dBand);
  // THE CHAIRS AS AN OUTLINE (2026-08-21). The six seats were a bunched row
  // of blocks with the open seat's sheet rendered somewhere below them all;
  // now the band is one .dtree — each chair a top-level node whose label is
  // the same .dseat button it always was, and the seat you are in expands:
  // its whole gig sheet (instruments and all) nests BENEATH its own chair
  // node, the same outline idiom as everywhere else on the page.
  const seats = el("ul", "dtree");
  for (const s2 of SEATS.filter((x) => x !== "arranger")) {
    // HOW MANY, NOT WHETHER. This said "1 question" for every chair that
    // had any question left at all — a chair with nine things still to
    // decide and a chair with one looked identical, which is exactly the
    // thing a session needs to tell you.
    const left = Band.pending(model, s2);
    const b = el("button", "dseat" + (seat === s2 ? " on" : "") + (left ? " asking" : ""));
    b.type = "button";
    b.dataset.k = "seat|" + s2;
    // the colon law joins the seat to its phrase ("drums: questions left:
    // 3"), and the count stays the LAST thing in the label (a gate reads
    // the trailing digits — /(\d+)$/, so the digits may not move off the
    // end); when nothing is left it is a word, not a checkmark
    b.append(s2 + ": " + (left ? "questions left: " + left : "all set"));
    b.addEventListener("click", () => {
      seat = s2; module_ = "band"; section = null; asking = null; draw(); });
    const li = el("li");
    // only the seat you are in carries its sheet — the one-question law is
    // untouched, and the other chairs stay one line each. The open sheet
    // FOLDS under its own seat line (foldOf: the summary is the .dseat
    // button, whose tap still switches seats — the guard keeps the toggle
    // off the button)
    if (module_ === "band" && section == null && seat === s2) {
      const det = foldOf("chair|" + s2, b);
      chairArea(det, s2, false);
      li.append(det);
    } else li.append(b);
    seats.append(li);
  }
  // the chairs are how you move between the players: a landmark
  dBand.append(navOf(seats, "the chairs"));
  box.append(sBand);
}

// A SECTION IS OPEN: everything on the floor is about this section. Each
// player's canned parts, then their OWN words — "swap hands", "ride it",
// "walk it" — then the two things a band says that neither player owns
// alone ("give it a lift", "follow the kick").
function sectionArea(parent) {
  const secs = toSong(model, MODES);
  const here = secs[section];
  floorQ = "sec|" + section;
  // THE SECTION'S OWN OUTLINE. A section is arranged as one conversation —
  // every question stays on the floor at once here, exactly as the gates
  // read it — but the same tree law shapes the page: a player's own words
  // ("at the kit", "the bass player") are only there because that player's
  // row is, so they NEST under it and the outline says whose words they are.
  const WORDSOF = { dwords: "drums", kwords: "keys", gwords: "guitar",
                    bwords: "bass", vwords: "voice" };
  const tree = el("ul", "dtree dsectree");
  const liOf = new Map();
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
    // a player's own words run long (34 at the kit) — the same radios,
    // laid in the .dcols grid (the grid law above). A SHORT question needs
    // no box at all: its options are the fieldset's own children.
    const row2 = a2.opts.length > LONG ? el("div", "dcols") : ask2;
    for (const o of a2.opts) {
      row2.append(optWidget(o.w, "dopt" + (o.answered ? " on" : ""), {
        kind: "radio", name: "sq-" + section + "-" + a2.id, on: o.answered,
        key: "opt|sec" + section + "|" + a2.id + "|" + o.key,
        take: takeSec(o) }), " ");
    }
    if (row2 !== ask2) ask2.append(row2);
    const li = el("li");
    li.append(ask2);
    liOf.set(a2.id, li);
    // the words-question rides under the player it belongs to; a pruned
    // player (nothing to ask) leaves its words at the top level rather
    // than dropping them
    const pLi = WORDSOF[a2.id] && liOf.get(WORDSOF[a2.id]);
    if (pLi) {
      let cu = pLi.lastElementChild && pLi.lastElementChild.tagName === "UL"
        ? pLi.lastElementChild : null;
      if (!cu) { cu = el("ul"); pLi.append(cu); }
      cu.append(li);
    } else tree.append(li);
  }
  parent.append(navOf(tree, "this section"));
}

/* ---------- THE COUNT ROW ------------------------------------------------
   "on the e of the one" sixteen times over is a word-pile; a bar is a 4×4
   GRID — columns one two three four, rows the beat / e / and / a — and the
   sentence stays the contract: every cell's tapped word is stepWord's own,
   byte for byte, so nothing a gate (or a ledger) ever read has moved. The
   MARK row above the grid chooses what a tap puts at that place (a note, an
   octave, an accent, a slide…) — everything past the note greys until a
   note exists there, which is the kit's own when-guard made visible. */
const stepWord = Band.B.stepWord;            // one table, every chair counts alike
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
function chairArea(parent, who, ideasOnly) {
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
                              : !d.id.startsWith("idea") && d.id !== "second"));
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
  // (A stale `asking` — "add a box" before the form is reachable — falls
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

  // THE GIG SHEET AS AN OUTLINE. Every question of this seat is a row —
  // an answered one says its word, an open one says its ask in italics —
  // grouped and nested by the OUTLINE/UNDER tables above, expanded, always.
  // A row is the same tappable .dfact it always was (the gates find facts
  // by the <b> label and the data-k, and both stay put); the one-question
  // law holds: tapping a row brings its question to the floor, and the
  // floor is IN PLACE now — the fieldset opens directly under that row's
  // own <li> (see the end of this function), never at a fixed slot below
  // the sheet, so at most one set of options exists at any time.
  const spec = ideasOnly
    // the theme's node is titled by what the record DOES with the tune —
    // Band.themeName derives hook/riff/figure/chant, nobody is asked; when
    // the answer theme is in hand, its own name heads the node
    ? [[Band.themeName(model, themeNow() === "b" ? "b" : undefined),
        ["len", "cell", "sent", "the bar", "contour", "land", "reg",
         "the answer", "second"]]]
    : OUTLINE[who] || [];
  const under = (ideasOnly ? UNDER.ideas : UNDER[who]) || {};
  const rowLi = new Map();                     // ask id -> its <li>, for the edges
  // THE ROW IS A NAME AND ITS VALUE: <dt> carries the control that re-asks
  // the question (a <button> in a <dt> is valid, and the label stays the
  // thing you tap), <dd> carries the answer as plain text — or, unanswered,
  // the question itself, which IS what that name is worth so far. A fact
  // the pruner left with nothing to change to has no control at all: the
  // term is a plain word.
  const rowOf = (d) => {
    const li = el("li");
    const dl = el("dl");
    if (flatFact(d)) {
      const f2 = el("span", "dfact", d.label);
      f2.dataset.k = "fact|" + d.id;
      dl.append(term(f2), el("dd", null, d.answered));
      li.append(dl);
      return li;
    }
    const c = el("button", "dfact" + (asking === d.id ? " open" : "") +
                           (q && q.id === d.id ? " qnow" : ""), d.label);
    c.type = "button";
    c.dataset.k = "fact|" + d.id;
    c.title = d.answered ? "change it: " + d.ask : d.ask;
    c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
    dl.append(term(c), el("dd", null, d.answered || d.ask));
    li.append(dl);
    return li;
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
  const tree = el("ul", "dtree");
  for (const [h, list] of branches) {
    const li = el("li", "dbranch");
    // the themes area's one headed branch IS the edited theme's node — its
    // heading is the theme's own (a switch once two themes exist). A HEADED
    // branch folds under its head (foldOf); a headless one has no label
    // line to be a summary and stays plain
    const head = h ? (ideasOnly ? themeNodeHead(themeNow(), true)
                                : el("span", "dthead", h)) : null;
    const fold = head
      ? foldOf("branch|" + who + "|" + (ideasOnly ? "theme" : h), head) : null;
    if (fold) li.append(fold);
    const bhost = fold || li;
    // THE ENGINEER'S CHANNEL TABLE (the basic-HTML reset): the five channel
    // questions align — channel down the label column, treatment beside it —
    // so this one branch is a real <table> instead of a run of <dl> rows,
    // and the browser does the aligning. It is the SAME shape as a fact row
    // with the table's own elements: <th scope="row"> is the term (the
    // tappable .dfact and the colon law's ":"), <td> is the value. That
    // scope is what pairs them for a screen reader — which is why the
    // hidden <b> label and hidden seam this cell used to carry are gone.
    if (h === "the channels" && who === "engineer" && !ideasOnly) {
      const table = el("table");
      for (const [, d] of list) {
        const tr = el("tr");
        const th = el("th"); th.scope = "row";
        const td = el("td", null, d.answered || d.ask);
        if (flatFact(d)) {
          const f2 = el("span", "dfact", d.label);
          f2.dataset.k = "fact|" + d.id;
          th.append(f2, ":");
        } else {
          const c = el("button", "dfact" + (asking === d.id ? " open" : "") +
                                 (q && q.id === d.id ? " qnow" : ""), d.label);
          c.type = "button";
          c.dataset.k = "fact|" + d.id;
          c.title = d.answered ? "change it: " + d.ask : d.ask;
          c.addEventListener("click", () => { asking = asking === d.id ? null : d.id; draw(); });
          th.append(c, ":");
        }
        tr.append(th, td);
        table.append(tr);
        rowLi.set(d.id, td);       // the ask lands in the cell, like any row
      }
      bhost.append(table);
      tree.append(li);
      continue;
    }
    const ul = el("ul");
    for (const [p, d] of list) {
      const row = rowOf(d);
      rowLi.set(d.id, row);
      // the dependency edge: this row nests under the row it exists
      // because of (the parent renders first — the tables order it so)
      const pk = p && under[p];
      const pks = !pk ? [] : Array.isArray(pk) ? pk : [pk];
      const pAsk = pks.length && asks.find(a => pks.some((x) => outMatch(x, a)));
      const pLi = pAsk && rowLi.get(pAsk.id);
      if (pLi) {
        let cu = pLi.lastElementChild && pLi.lastElementChild.tagName === "UL"
          ? pLi.lastElementChild : null;
        if (!cu) { cu = el("ul"); pLi.append(cu); }
        cu.append(row);
      } else ul.append(row);
    }
    bhost.append(ul);
    tree.append(li);
  }
  if (ideasOnly) {
    // THE SENTENCE UNDER THE THEME NODE: the per-measure strip nests under
    // the "how it speaks" row it visualizes — the sentence plan and its
    // measures in one place — and falls back to the node's own list when
    // the pruner has retired that row (the strip may not vanish with it:
    // a plain sentence is still two measures the eye should see agree)
    const strip = sentStrip(themeOf(model, themeNow()) || model.idea);
    if (strip) {
      const sLi = rowLi.get((themeNow() === "b" ? "ideaB:" : "idea:") + "sent");
      const li2 = el("li");
      li2.append(strip);
      const home = sLi || tree.querySelector("li.dbranch");
      if (sLi) {
        let cu = sLi.lastElementChild && sLi.lastElementChild.tagName === "UL"
          ? sLi.lastElementChild : null;
        if (!cu) { cu = el("ul"); sLi.append(cu); }
        cu.append(li2);
      } else if (home) {
        let cu = home.lastElementChild && home.lastElementChild.tagName === "UL"
          ? home.lastElementChild : null;
        if (!cu) { cu = el("ul"); home.append(cu); }
        cu.append(li2);
      }
    }
    // ...and the OTHER theme stands beside the edited one as a node of its
    // own — A above B, the record's own order, whichever is in hand — with
    // its name for a heading (the switch) and one dim line of what it is.
    // Its questions are not here: one home per question, and the home is
    // the node in the editing hand.
    if (model.ideaB && model.ideaB.on) {
      const other = themeNow() === "b" ? "a" : "b";
      const oli = el("li", "dbranch");
      oli.append(themeNodeHead(other, false));
      const om = themeOf(model, other);
      if (om) oli.append(el("p", "dthemesum", Band.Id.describe(om)));
      if (other === "a") tree.prepend(oli); else tree.append(oli);
    }
  }
  // this chair's sheet is how you move around its facts: a landmark
  if (tree.childElementCount) parent.append(navOf(tree, seatWord(who)));
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
  if (!q) return;
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
        const BW = ["bar one", "bar two", "bar three", "bar four"];
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
    const grid = el("table", "dgrid");
    { const thr = el("tr");
      thr.append(el("th"));
      for (const c of ["one", "two", "three", "four"]) {
        const th = el("th", null, c); th.scope = "col"; thr.append(th);
      }
      const thead = el("thead"); thead.append(thr); grid.append(thead); }
    const gbody = el("tbody");
    const SUBS = ["\u00b7", "e", "and", "a"];
    for (let sub = 0; sub < 4; sub++) {
      const gtr = el("tr");
      { const th = el("th", null, SUBS[sub]); th.scope = "row"; gtr.append(th); }
      for (let beat = 0; beat < 4; beat++) {
        const i = beat * 4 + sub;
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
  // the order a musician lists them — plain .drowlab rows in the flow,
  // full-width rows when the list runs long enough to grid
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
  {
    // a long one-of-N gets the SAME radios, laid in the .dcols grid (the
    // grid law above); its row labels are the same .drowlab rows, spanning
    // the grid's whole width. A SHORT question needs no box at all: its
    // options are the fieldset's own children.
    const row = kind === "radio" && opts2.length > LONG ? el("div", "dcols") : ask;
    let lastRow = null;
    for (const o of opts2) {
      if (rowed && o.row !== lastRow) { row.append(el("div", "drowlab", o.row)); lastRow = o.row; }
      row.append(optWidget(o.w, "dopt" + (o.on ? " on" : "") +
                                 (!o.on && o.istrue ? " istrue" : ""), {
        kind, name: "q-" + who + "-" + q.id, on: o.on, dead: o.dead,
        key: "opt|" + who + "|" + q.id + "|" + o.w,
        take: fire(o) }), " ");
    }
    if (row !== ask) ask.append(row);
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
  // slot below the whole sheet; it opens AT ITS ROW now — the outline
  // expands at that node and the page grows vertically. Every ask has a
  // row (the trailing headless branch catches whatever the tables do not
  // name), and the fieldset lands in that row's own <li>, immediately
  // after its name/value pair and above any child rows nesting beneath the
  // same node — or, on the engineer's channel branch, in the row's own
  // cell. (It used to need a .dqbox wrapper for a dashed outline the
  // basic-HTML reset took away; the wrapper outlived the paint.)
  const qLi = rowLi.get(q.id);
  if (qLi && qLi.tagName === "TD") qLi.append(ask);
  else if (qLi && qLi.firstElementChild) qLi.firstElementChild.after(ask);
  else if (qLi) qLi.append(ask);
  else parent.append(ask);
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
  if (playing) { stop(); playWord(); }
  model = { ...Band.blank(), on: true };
  said.clear(); asking = null; section = null; picker = null;
  module_ = "song"; seat = "drums";
  ledger.length = 0;
  clearMixOffsets();
  try { localStorage.removeItem(SAVE); } catch (e) {}
  push(true); draw();
});
// THE DICE — a whole record by answering every question at random, which is
// only possible because the graph is complete: every question has at least
// two answers and none of them leads anywhere unplayable. It is the ordinary
// path taken quickly, not a special one.
$("ddice").addEventListener("click", () => {
  model = Band.randomSong();
  said.clear(); asking = null; section = null; picker = null; module_ = "song";
  ledger.length = 0;
  clearMixOffsets();
  push(true); draw();
  if (!playing) startAt(0);
  playWord(true);
});
$("dplay").addEventListener("click", () => {
  if (playing) { stop(); playWord(); }
  else if (model.on) { startAt(0); playWord(true); }
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
    pendEl.append(el("div", "dpline", pendPhrase(g.names, g)));
  if (lines.length > 2)
    pendEl.append(el("div", "dpmore", "+ " + (lines.length - 2) + " more waiting"));
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
window.__nuTempo = () => model.song.bpm;      // the gate reads tempo as part of the artifact
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
