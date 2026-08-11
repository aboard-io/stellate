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

export const DOC = { seed: 0x1249, rule: 110, key: 0, genre: "acidhouse" };

// The bases offered as chips. Any anchor works — `?g=` accepts all 274 and is
// validated against K.GENRES — but a picker over 274 rows is the surface this
// page is arguing against, so the chips are a spread across the space and the
// URL is the escape hatch.
export const BASES = ["acidhouse", "techno", "jungle", "dub", "boombap", "trap",
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
const keyOf = () => DOC.seed + ":" + DOC.rule + ":" + DOC.key + ":" + DOC.genre;

export function edit(p) { Object.assign(DOC, p); _key = null; writeUrl(); touch(); }

export function resolved() {
  const k = keyOf();
  if (k === _key && _res) return _res;
  const t = K.track(DOC.genre, { seed: 7 });
  const base = JSON.parse(JSON.stringify(t.state || t));
  _res = CA.apply(base, { seed: DOC.seed, rule: DOC.rule, key: DOC.key, engine: E });
  _key = k; _ev = null;
  return _res;
}
export const state = () => resolved().state;
export function events() { if (!_ev) _ev = E.buildEvents(state()); return _ev; }

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
  _key = null;
}
export function url() {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("s", DOC.seed.toString(16).padStart(4, "0"));
  u.searchParams.set("r", String(DOC.rule));
  if (DOC.key) u.searchParams.set("k", String(DOC.key));
  if (DOC.genre !== "acidhouse") u.searchParams.set("g", DOC.genre);
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
