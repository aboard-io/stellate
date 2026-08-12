// doc.js — THE DOCUMENT: 24 bits, a key, and a base genre.
//
//   seed  16 bits   the row you tapped
//   rule   8 bits   which of the 256 elementary CA rules grows it
//   key    4 bits   where the PLR walk starts
//   genre           which anchor lends its instruments and mix
//
// The first three ARE the composition. The genre is not: it is the timbre the
// composition is played on, exactly as a score is not its orchestra. That split
// is why the URL is short and why changing the sound cannot change the song.
//
// DELIBERATELY NOT importing app/daw/song.js. The DAW's document is a patch over
// a resolved kernel state — twelve whitelisted keys, three sanitizers and a
// per-section override table. This page exists to find out whether all of that
// can be replaced by two numbers, so borrowing its store would beg the question.
// What both share is the ENGINE, and nothing else.
const K = window.GenreKernel, E = window.CsdEngine, CA = window.CsdCA;

// `bpm: null` means "the base genre's own", and null is stored rather than the
// resolved number ON PURPOSE: writing 122 the moment the page loads would freeze
// the tempo to whatever acidhouse happened to say, and switching to `jungle`
// would then quietly stay at 122. Absent means following; a number means yours.
export const DOC = { seed: 0x1249, rule: 110, key: 0, genre: "acidhouse", bpm: null, bars: 12,
  // WHERE THE CHORDS COME FROM. "seed" = the automaton's own PLR walk, read off
  // the row. "genre" = leave the base anchor's progression alone, because a
  // genre's identity often IS its progression — city pop is the 1625 and no
  // cellular automaton is going to find that by accident.
  harmony: "seed" };
// `loop` is NOT part of the document: it is a monitoring mode, like solo on a
// mixer. It changes what you HEAR, never what the link says.
export let LOOP = false;
export const BARS = [4, 6, 8, 12];
export const BPM_MIN = 50, BPM_MAX = 200;

// The bases offered as chips. Any anchor works — `?g=` accepts all 274 and is
// validated against K.GENRES — but a picker over 274 rows is the surface this
// page is arguing against, so the chips are a spread across the space and the
// URL is the escape hatch.
export const BASES = ["house", "acidhouse", "techno", "disco", "jungle", "dub", "boombap", "trap",
  "vaporwave", "citypop", "ambient", "krautrock", "bossanova", "ragtime"];

export const subs = [];
let raf = 0;
export function touch() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); });
}

// ---------------------------------------------------------------- resolution
// One memo over the whole document. `CA.apply` is microseconds and buildEvents
// is the same call the live walk makes every bar, so there is no caching layer
// here beyond "did anything actually change" — the orbit repaints on every cell
// you tap and the cost is invisible.
let _key = null, _res = null, _ev = null;
const keyOf = () => [DOC.seed, DOC.rule, DOC.key, DOC.genre, DOC.bpm, DOC.bars, DOC.harmony].join(":");

export function edit(p) { Object.assign(DOC, p); _key = null; push(); writeUrl(); touch(); }

export function resolved() {
  const k = keyOf();
  if (k === _key && _res) return _res;
  const t = K.track(DOC.genre, { seed: 7 });
  const base = JSON.parse(JSON.stringify(t.state || t));
  _res = CA.apply(base, { seed: DOC.seed, rule: DOC.rule, key: DOC.key, engine: E,
    bars: DOC.bars, harmony: DOC.harmony });
  _res.stockProg = base.progression;
  // TEMPO IS NOT ONE OF THE 24 BITS, and it is not part of the orchestra either
  // — it is the third thing, alongside key: a property of the performance. It is
  // applied AFTER the automaton, so it changes nothing the lenses produced (the
  // kit's beat offsets, the cell durations and the form are all in BEATS, which
  // is exactly why a tempo change cannot reshape the song).
  if (DOC.bpm) _res.state.bpm = DOC.bpm;
  _res.stockBpm = base.bpm;
  _key = k; _ev = null;
  return _res;
}
export const state = () => resolved().state;
export function events() { if (!_ev) _ev = E.buildEvents(state()); return _ev; }

// WHAT THE ENGINE GETS, which is not always what the page SHOWS. `resolved()` is
// always the whole song, because the orbit view must keep showing the form even
// while you are auditioning one bar of it — folding the loop into resolved()
// collapsed the plan to a single row and the song view vanished with it. So the
// audition is a second, separate build, and `playState` is the only thing that
// knows the difference.
let _lk = null, _lr = null;
export function playState() {
  if (!LOOP) return state();
  const k = keyOf();
  if (k !== _lk || !_lr) {
    const t = K.track(DOC.genre, { seed: 7 });
    const base = JSON.parse(JSON.stringify(t.state || t));
    _lr = CA.apply(base, { seed: DOC.seed, rule: DOC.rule, key: DOC.key, engine: E,
      audition: 0, harmony: DOC.harmony });
    if (DOC.bpm) _lr.state.bpm = DOC.bpm;
    _lk = k;
  }
  return _lr.state;
}

// ------------------------------------------------------------------ the cells
export const cells = () => CA.cells(DOC.seed);
export function toggleCell(i) {
  if (i < 0 || i >= CA.N) return;
  edit({ seed: (DOC.seed ^ (1 << i)) >>> 0 & CA.MASK });
}
export function setCell(i, on) {
  if (i < 0 || i >= CA.N) return;
  const next = (on ? DOC.seed | (1 << i) : DOC.seed & ~(1 << i)) >>> 0 & CA.MASK;
  if (next !== DOC.seed) edit({ seed: next });
}

// ------------------------------------------------------------ START FROM A GENRE
// The one-tap answer to "how do I make a house track". A genre chip only ever
// lent you its ORCHESTRA — instruments, mix, tempo — while the rhythm, the
// harmony and the form all came from 24 genre-blind bits, so picking `citypop`
// gave you city pop timbres playing an automaton. This sets the other three:
//
//   the ROW      derived from the anchor's own kit (CA.seedFromKit), so house
//                starts on four to the floor and boom bap starts on boom bap
//   the HARMONY  switched to the anchor's progression — city pop's 1625
//   the TEMPO    handed back to the anchor
//
// One gesture, so one undo puts you back. Everything it sets stays editable —
// it is a starting point, not a mode.
export function startFrom(g) {
  if (!K.GENRES[g]) return;
  beginGesture();
  const t = K.track(g, { seed: 7 });
  const st = t.state || t;
  const seed = CA.seedForState(st, E) || DOC.seed;
  edit({ genre: g, seed, harmony: "genre", bpm: null });
  endGesture();
}
export const setHarmony = (h) => edit({ harmony: h === "genre" ? "genre" : "seed" });
// the progression actually in force, for the readout
export function progLabel() {
  const r = resolved();
  const p = r.state.progression;
  if (typeof p === "object" && p.caTriads) return { plr: true, label: p.label.replace("CA · ", ""), chords: p.caTriads };
  const got = E.PROGRESSIONS[p];
  return { plr: false, label: (got && got.label) || String(p), chords: (got ? got.chords : []).map((c) => c.name) };
}

// ------------------------------------------------------------------ THE LOOP
// Audition the seed bar on repeat. This is the single thing that separates an
// instrument from a generator: without it the gap between "tap a cell" and
// "hear what that did" is the length of a song, so you cannot hear a decision,
// only a result. exploreLive re-reads getState() every chord bar and wraps at
// the end of the form, so a one-section state loops with no transport work.
export function setLoop(on) {
  const v = !!on;
  if (v === LOOP) return;
  LOOP = v; _lk = null; touch();
}
export const isLoop = () => LOOP;

// ---------------------------------------------------------------- THE HISTORY
// The document is a handful of numbers, so undo is a stack of copies and costs
// nothing. It exists because every edit here is GLOBAL — tapping one cell
// rewrites the whole song — which makes an accidental change unrecoverable by
// hand in a way that a note editor's never is.
//
// COALESCED BY GESTURE, NOT BY CLOCK. The first cut merged any two edits inside
// 400ms, which is a guess about human speed that the machine gets to vote on:
// each edit repaints the orbit, the lanes and 256 rule thumbnails, so under load
// a five-cell drag exceeded the window and became five undos. A drag KNOWS when
// it starts and ends, so it says so — and a discrete tap stays its own undo,
// which is what anyone expects anyway.
const HIST = [snap()], MAXH = 200;
let hAt = 0, inGesture = false;
function snap() { return { seed: DOC.seed, rule: DOC.rule, key: DOC.key, genre: DOC.genre, bpm: DOC.bpm, bars: DOC.bars }; }
function push() {
  const cur = snap();
  if (JSON.stringify(cur) === JSON.stringify(HIST[hAt])) return;
  if (inGesture && hAt === HIST.length - 1 && hAt > 0) { HIST[hAt] = cur; return; }
  HIST.length = hAt + 1;
  HIST.push(cur);
  if (HIST.length > MAXH) HIST.shift();
  hAt = HIST.length - 1;
  inGesture = gestureOpen;    // the FIRST edit of a gesture opens a new entry;
}                             // every later one inside it merges into that entry
// A continuous gesture (a finger dragged across the row, a tile dragged) is ONE
// undo. Call begin on pointerdown and end on pointerup; unbalanced calls are
// harmless — the worst case is an extra undo step.
export function beginGesture() { inGesture = false; gestureOpen = true; }
export function endGesture() { gestureOpen = false; inGesture = false; }
let gestureOpen = false;
function restore(i) {
  hAt = Math.max(0, Math.min(HIST.length - 1, i));
  Object.assign(DOC, HIST[hAt]);
  _key = null; writeUrl(); touch();
}
export const canUndo = () => hAt > 0;
export const canRedo = () => hAt < HIST.length - 1;
export function undo() { if (canUndo()) restore(hAt - 1); }
export function redo() { if (canRedo()) restore(hAt + 1); }

// ------------------------------------------------------------------ the tempo
// `bpm()` is what is SOUNDING (yours, or the genre's); `bpmSet()` is whether you
// have said anything. `bpmRevert()` deletes the override rather than writing the
// stock number back — see the DOC comment above for why that distinction is the
// whole design of this field.
export const bpm = () => DOC.bpm || Math.round(resolved().stockBpm || 120);
export const bpmSet = () => DOC.bpm != null;
export const setBpm = (v) => edit({ bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(v))) });
export const bpmRevert = () => edit({ bpm: null });

// ----------------------------------------------------------------------- URL
// ?s=<hex>&r=<0..255>&k=<0..11>&g=<anchor>. Every field is a NUMBER or a key of
// the committed genre table, so a stranger's link cannot name anything the
// project does not already ship — the no-remote-sources law by construction,
// with no sanitizer to write. That is the quiet payoff of a 24-bit document.
export function readUrl() {
  const q = new URLSearchParams(location.search);
  const s = parseInt(q.get("s"), 16);
  if (s >= 0) DOC.seed = (s >>> 0) & CA.MASK;
  const r = parseInt(q.get("r"), 10);
  if (r >= 0 && r <= 255) DOC.rule = r | 0;
  const k = parseInt(q.get("k"), 10);
  if (k >= 0 && k <= 11) DOC.key = k | 0;
  const g = q.get("g");
  if (g && K.GENRES[g]) DOC.genre = g;
  const b = parseInt(q.get("b"), 10);
  if (b >= BPM_MIN && b <= BPM_MAX) DOC.bpm = b | 0;
  const n = parseInt(q.get("n"), 10);
  if (BARS.indexOf(n) >= 0) DOC.bars = n;
  if (q.get("h") === "genre") DOC.harmony = "genre";
  _key = null;
}
export function url() {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("s", DOC.seed.toString(16).padStart(4, "0"));
  u.searchParams.set("r", String(DOC.rule));
  if (DOC.key) u.searchParams.set("k", String(DOC.key));
  if (DOC.genre !== "acidhouse") u.searchParams.set("g", DOC.genre);
  if (DOC.bpm) u.searchParams.set("b", String(DOC.bpm));
  if (DOC.bars !== 12) u.searchParams.set("n", String(DOC.bars));
  if (DOC.harmony === "genre") u.searchParams.set("h", "genre");
  return u.toString();
}
function writeUrl() { try { history.replaceState(null, "", url()); } catch (e) {} }

// ------------------------------------------------------------------- rolling
// A roll must land somewhere WORTH HEARING, and most of the 256 rules are dead
// or trivial on a 16-cell ring. So it draws until the orbit has a cycle longer
// than one and the form has at least six sections — a handful of tries, never a
// loop that can hang. (Math.random is fine here: the roll picks the document,
// it is not part of rendering it. The 24 bits it lands on are then as
// deterministic as any other.)
export function roll() {
  for (let i = 0; i < 200; i++) {
    const seed = (Math.random() * 65536) | 0, rule = (Math.random() * 256) | 0;
    const orb = CA.orbit(seed, rule);
    if (orb.cycle === 1 && CA.pop(orb.rows[orb.rows.length - 1]) === 0) continue;   // it died
    if (CA.formGens(orb, 12).length < 6) continue;
    edit({ seed, rule });
    return;
  }
  edit({ seed: 0x1249, rule: 110 });
}
