// paper.js — the score's engraving helpers, shared. These stood in
// ui/eight.js (the band score, "one engraving, moved at a steady speed") until
// the lilguys page needed exactly the same paper for its play-along staff
// (2026-11-01), and a second notation path beside the one that works was the
// wrong answer. Moved, not rewritten: every body below is eight.js's, byte for
// byte, except that `indexVoices` takes the step count it used to read off a
// global. eight.js imports them all back; the long arguments for each still
// sit beside the code that calls them there.
//
//   SCOREHEAD     a drum lane -> its notehead on the percussion staff
//   chordName     a degree and quality -> the chord symbol a copyist writes
//   inkChords     chord names onto the first staff of a one-line toScore string
//   paperGeom     abcjs's own tune object -> width, margin, staff lines, time->x map
//   indexVoices   toScore's voices -> per step, which glyphs are sounding
//   loadStaffLib  the vendored abcjs, loaded once
import { noteNameOf } from "./abc.js";

const K = window.NuKernel;

export const SCOREHEAD = { k: "F", s: "c", p: "c", c: "c",
                    t: "e", m: "d", l: "A",
                    h: "!style=x!g", o: "!style=x!g", f: "!style=x!D",
                    r: "!style=x!f", x: "!style=x!a" };

export function chordName(d, q, key, mode) {
  const md = mode && mode.length ? mode : K.MODE;
  const at = (i) => md[((i % md.length) + md.length) % md.length] +
                    12 * Math.floor(i / md.length);
  const root = at(d), third = at(d + 2), fifth = at(d + 4);
  const t = ((third - root) % 12 + 12) % 12, f = ((fifth - root) % 12 + 12) % 12;
  const name = noteNameOf(root + key, key, md);
  const mark = K.QMARK[q] == null ? String(q || "") : K.QMARK[q];
  if (K.QFIX[q]) return name + mark;
  let qual = "";
  if (q === "sus4") qual = "sus4";
  else if (t === 3 && f === 6) qual = "dim";
  else if (t === 4 && f === 8) qual = "aug";
  else if (t === 3) qual = "m";
  const tail = q === "sus4" ? "" : mark;
  return name + qual + (qual === "dim" || qual === "aug" ? "" : tail);
}

export function inkChords(abc, names, totalBars) {
  if (!names) return abc;
  const lines = abc.split("\n");
  const vi = lines.findIndex((l) => /^V:V1(\s|$)/.test(l));
  if (vi < 0) return abc;
  let mi = vi + 1;
  while (mi < lines.length && /^K:/.test(lines[mi])) mi++;
  if (mi >= lines.length || /^V:/.test(lines[mi])) return abc;
  const bits = lines[mi].split(/( \|{1,2} )/);
  if ((bits.length + 1) / 2 !== totalBars) return abc;      // refuse to mis-label
  let close = "";
  const cm = / \|\]$/.exec(bits[bits.length - 1]);
  if (cm) { close = cm[0]; bits[bits.length - 1] = bits[bits.length - 1].slice(0, cm.index); }
  let prev = null;
  for (let b = 0; b < totalBars; b++) {
    const n = names[b];
    if (!n || n === prev) continue;
    prev = n;
    bits[2 * b] = '"' + n + '"' + bits[2 * b];
  }
  lines[mi] = bits.join("") + close;
  return lines.join("\n");
}

export function paperGeom(tune) {
  const g = tune && tune.engraver && tune.engraver.staffgroups &&
            tune.engraver.staffgroups[0];
  if (!g || !(g.w > 0)) return null;
  // WHERE A MOMENT IS, IN PAPER. Every voice of a system shares one x for one
  // musical instant (that is what barring through MEANS), so the map is built
  // by walking each voice's children and summing their durations — abcjs's own
  // `duration` is in whole notes, so a sixteenth is 0.0625 and our step is
  // `1 / scoreSPB()`. The staff-extras (clef, meter) are skipped: they sit in
  // the left margin at time zero and their x would put the first note's
  // instant in the gutter. A NOTE BEATS A BARLINE at the same instant — the
  // barline is drawn a notehead's width to the left of the downbeat it
  // precedes, and it is the note that sounds.
  const at = new Map();
  for (const v of g.voices || []) {
    let t = 0;
    for (const c of v.children || []) {
      const extra = /staff-extra/.test(c.type || "");
      if (!extra && c.x != null) {
        const k = Math.round(t * 1e4);
        const bar = /bar/.test(c.type || "");
        const had = at.get(k);
        if (had == null || (had.bar && !bar)) at.set(k, { x: c.x, bar });
      }
      t += c.duration || 0;
    }
  }
  const map = [...at.entries()].map(([k, v]) => [k / 1e4, v.x])
                               .sort((a, b) => a[0] - b[0]);
  if (!map.length) return null;
  const staffs = g.staffs || [];
  /* WHERE THE PAPER STOPS BEING TIME. Everything left of the first note — the
     voice names, the clef, the key signature, the meter — is a LEFT MARGIN,
     and it is the one thing on this surface that has width without duration.
     Measured 2026-08-25 at 390px on a seven-voice reggae: 171px of it, which
     is a bar and a bit. It is cropped off here and drawn ONCE in the box's own
     gutter, out of this same engraving (`gutterFrom`) — which on a picture
     that is one system long is the only clef a reader will see after the first
     four bars have gone past. */
  const x0 = Math.max(0, map[0][1] - 6);
  // …and where the STAFF starts, which is the same margin with the voice
  // names taken off it. The gutter needs both: see `gutterFrom`.
  /* …AND WHERE EACH STAFF SITS, which is the fact a motif label under a PART
     is hung off. `topLine` / `bottomLine` are abcjs's own numbers for the
     outer two lines of staff i, in the same user units as `w` and the map, and
     they are exact: measured against the rendered `path.abcjs-staff` bounding
     boxes at 390px on 2026-08-27, 41.94/72.94 against 41.6/73.3 — the same two
     lines, read without asking the page for a layout. */
  return { w: g.w, x0, sx: Math.max(0, (g.startx || 0) - 2),
           y0: (staffs[0] || {}).absoluteY || 0, map,
           ys: staffs.map((s) => ({ top: +s.topLine || 0,
                                    bottom: +s.bottomLine || 0 })) };
}

export function indexVoices(voices, steps) {
  return voices.map((v) => {
    const byStep = new Int32Array(Math.max(1, steps)).fill(-1);
    v.notes.forEach((nt, i) => {
      const end = Math.min(steps, nt.at + Math.max(1, nt.len));
      for (let s = Math.max(0, nt.at); s < end; s++) byStep[s] = i;
    });
    const byNote = [];
    v.glyphs.forEach((ni, g) => { (byNote[ni] || (byNote[ni] = [])).push(g); });
    return { name: v.name, notes: v.notes, glyphs: v.glyphs, byStep, byNote };
  });
}

let abcLib = null;
export function loadStaffLib() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (!abcLib) abcLib = new Promise((ok, no) => {
    const sc = document.createElement("script");
    sc.src = new URL("../../vendor/abcjs/abcjs-basic-min.js", import.meta.url).href;
    sc.async = true;
    sc.onload = () => ok(window.ABCJS);
    sc.onerror = () => { abcLib = null; sc.remove(); no(new Error("abcjs did not arrive")); };
    document.head.append(sc);
  });
  return abcLib;
}

/* WHERE AN INSTANT IS ON THE PAPER, as a pure function of `paperGeom`'s map:
   `t` in whole notes (abcjs's own unit), the answer in the SVG's user units.
   Between two laid-out instants it interpolates; past the last it runs on to
   the system's right edge at `endT`. ui/eight.js `paperX` is this, wrapped in
   that page's scale and crop; the lilguys staff calls it bare. */
export function paperXAt(geom, t, endT) {
  const map = geom && geom.map;
  if (!map || !map.length) return 0;
  if (t <= map[0][0]) return map[0][1];
  let lo = 0, hi = map.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (map[m][0] <= t) lo = m; else hi = m; }
  const a = map[lo], b = map[hi];
  if (t >= b[0]) {
    if (!(endT > b[0]) || t >= endT) return t >= endT ? geom.w : b[1];
    return b[1] + (geom.w - b[1]) * (t - b[0]) / (endT - b[0]);
  }
  return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
}
