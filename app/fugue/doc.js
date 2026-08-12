// doc.js — the /fugue document: a subject and five numbers.
//
//   subject   the line, in ladder degrees
//   answer    how far up the second voice enters (2 = the fifth)
//   voices    2..4
//   overlap   1 = in turn, 0.5 = stretto
//   later     the transforms added after the exposition
//   genre     which anchor performs it
//
// Everything the page shows is a pure function of those, which is what lets the
// page be its own documentation: each section can render its own option's effect
// without asking anyone what else is going on.
const F = window.CsdFugue, K = window.GenreKernel, E = window.CsdEngine;

export const DOC = {
  subject: F.DEFAULT_SUBJECT.map((n) => n.slice()),
  answer: 2, voices: 3, overlap: 1, later: [], genre: "neoclassical", pads: false,
};

export const subs = [];
let raf = 0;
export function touch() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); });
}
export function edit(p) { Object.assign(DOC, p); _k = null; writeUrl(); touch(); }

// ---------------------------------------------------------------- resolution
let _k = null, _plan = null, _cells = null;
const keyOf = () => JSON.stringify([DOC.subject, DOC.answer, DOC.voices, DOC.overlap, DOC.later]);
function resolve() {
  const k = keyOf();
  if (k !== _k) {
    _plan = F.plan({ subject: DOC.subject, answer: DOC.answer, voices: DOC.voices, overlap: DOC.overlap, later: DOC.later });
    _cells = F.cells(_plan, Math.max(4, Math.min(64, Math.ceil(_plan.total / 2) * 2)));
    _k = k;
  }
}
export function planNow() { resolve(); return _plan; }
export function cellsNow() { resolve(); return _cells; }

// A SCOPE is what one section of the page is about, and playing it is how that
// section shows its effect. Playing the finished piece while explaining one
// option teaches nothing about the option.
const SCOPE = {
  subject: { voices: 1, later: [] },
  answer: { voices: 2, later: [] },
  exposition: { later: [] },
  later: {},
  all: {},
};
export function state(scope) {
  const o = SCOPE[scope] || {};
  const t = K.track(DOC.genre, { seed: 7 });
  const base = JSON.parse(JSON.stringify(t.state || t));
  return F.build(base, {
    subject: DOC.subject, answer: DOC.answer,
    voices: o.voices != null ? o.voices : DOC.voices,
    overlap: DOC.overlap,
    later: o.later != null ? o.later : DOC.later,
    pads: DOC.pads, cycles: 2, engine: E,
  }).state;
}

// ----------------------------------------------------------------------- URL
// The subject rides as one digit per note (degree at a fixed eighth-note grid,
// `.` for a rest), which keeps a shareable link short and — like /ca's — makes
// every field either a small number or a key of the committed genre table, so
// there is no sanitizer to write.
const enc = (s) => {
  const n = Math.max(1, Math.round(F.spanOf(s) / 0.5));
  const out = new Array(n).fill(".");
  for (const [b, , g] of s) { const i = Math.round(b / 0.5); if (i >= 0 && i < n) out[i] = String(g); }
  return out.join("");
};
function dec(str) {
  const out = [];
  for (let i = 0; i < str.length && i < 32; i++) {
    const c = str[i];
    if (c < "0" || c > "7") continue;
    out.push([i * 0.5, 0.5, +c]);
  }
  for (let i = 0; i < out.length; i++) out[i][1] = Math.min((i + 1 < out.length ? out[i + 1][0] : out[i][0] + 0.5) - out[i][0], 2);
  return out.length ? out : null;
}
export function readUrl() {
  const q = new URLSearchParams(location.search);
  const s = dec(q.get("s") || "");
  if (s) DOC.subject = s;
  const a = parseInt(q.get("a"), 10); if (a >= 0 && a <= 7) DOC.answer = a;
  const v = parseInt(q.get("v"), 10); if (v >= 2 && v <= 4) DOC.voices = v;
  const o = parseFloat(q.get("o")); if (o >= 0.25 && o <= 1) DOC.overlap = o;
  const l = (q.get("t") || "").split(",").filter((x) => F.TRANSFORMS.indexOf(x) >= 0 && x !== "subject");
  if (l.length) DOC.later = l;
  const g = q.get("g"); if (g && K.GENRES[g]) DOC.genre = g;
  if (q.get("p") === "1") DOC.pads = true;
  _k = null;
}
export function url() {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("s", enc(DOC.subject));
  if (DOC.answer !== 2) u.searchParams.set("a", String(DOC.answer));
  if (DOC.voices !== 3) u.searchParams.set("v", String(DOC.voices));
  if (DOC.overlap !== 1) u.searchParams.set("o", String(DOC.overlap));
  if (DOC.later.length) u.searchParams.set("t", DOC.later.join(","));
  if (DOC.genre !== "neoclassical") u.searchParams.set("g", DOC.genre);
  if (DOC.pads) u.searchParams.set("p", "1");
  return u.toString();
}
function writeUrl() { try { history.replaceState(null, "", url()); } catch (e) {} }
