#!/usr/bin/env node
/* tools/remix.js — AUTO REMIX: a MIDI file in, a genre row and a session out.
 *
 *   node tools/remix.js <file.mid> [--name <key>] [--seed n] [--out <dir>]
 *                                  [--label "Place Year"] [--dry] [--install]
 *                                  [--json <path>]
 *
 * THE CONTRACT IS docs/REMIX.md and this file implements its six steps. Zero
 * dependencies, deterministic, and every decision is PRINTED with a confidence
 * either way — a run that says nothing has told you nothing.
 *
 * IT IS A PIPELINE, NOT AN ENGINE, and that is the whole design. Four fifths of
 * the arithmetic already had an owner in this tree and none of it is retyped
 * here:
 *
 *   the SMF parser, the tempo fold, the key detector, the GM drum lanes and the
 *   per-bar chord estimate          tools/mine/mine-midi.js
 *   the window/skyline/medoid       tools/mine/mine-melody.js   (lifted out of
 *                                   its main() this round, cut and pasted)
 *   the velocity lean               tools/mine/mine-groove.js   (the same move)
 *   the per-note dynamic figures    nukernel/genres-tables.js FIGURES
 *   the feature space and the NNLS  tools/genealogy.js          (given a home
 *                                   this round; it was living in scratchpad/)
 *   the row schema and the emitter  tools/genres/{grammar,emit,build}.js
 *   the record it all compiles to   nukernel/{precompose,document}.js
 *
 * WHAT THIS FILE OWNS, and it is deliberately small: the SELF-SIMILARITY pass
 * that turns bars into a form, the mapping from a mined window onto the box's
 * own cell vectors (deg / play / vel / acc / alt), the measurement of a file's
 * velocities against the nine FIGURES, and the prose of the row's `note`.
 *
 * ---- THE FIVE HONESTIES, stated once here -------------------------------
 *
 * 1. NOTATION TEMPO IS A CONVENTION. mine-midi.js says so at its own head and
 *    the ragtime anchor's first press was slow for exactly this reason. So the
 *    bpm this tool writes is the notated tempo TIMES a metric factor it argues
 *    for out of the bass line's own modal inter-onset interval, and both
 *    numbers are printed with the evidence.
 *
 * 2. A SECTION NAME IS A GUESS. The self-similarity pass measures where the
 *    music repeats, which is real; calling the most-repeated block a CHORUS is
 *    an inference from a twentieth-century pop form onto a file that may be a
 *    Bach prelude. Every name is printed as a guess with the count behind it,
 *    and the row's `note` keeps them as guesses.
 *
 * 3. THE MELODY LINE'S IDENTITY IS A GUESS. "The highest sounding part" is a
 *    heuristic, not a fact — it is wrong for a tenor cantus firmus, wrong for a
 *    left-hand stride figure, and wrong wherever the tune is in the middle. The
 *    margin behind the choice is printed and the row's note keeps it.
 *
 * 4. TIMBRE AND PRODUCTION ARE NOT IN THE FILE. A GM program number is the
 *    TRANSCRIBER's choice of patch and this trove is largely piano
 *    transcriptions; the tone block below is FIXED and declared, not measured.
 *    Reverb, saturation, room, width, the mix — a .mid says nothing about any
 *    of it and neither does the row.
 *
 * 5. A ROW DERIVED FROM ONE RECORDING IS NOT A GENRE. It gets no invented place
 *    and no invented year, and therefore — by genres-build G2's own law, which
 *    reads "a label is a Place Year IF AND ONLY IF the row declares parents" —
 *    no `parents` either. What the fit tool says it is NEAREST to, and the
 *    residue against those neighbours, is printed and written into the note as
 *    a MEASUREMENT. `--label "Place Year"` is the door for a human who actually
 *    knows where a file came from: given one, the row declares fitted parents
 *    and the label law is satisfied honestly rather than by invention.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const Mine = require("./mine/mine-midi.js");
const Mel = require("./mine/mine-melody.js");
const Groove = require("./mine/mine-groove.js");
const Gen = require("./genealogy.js");
const { validate } = require("./genres/grammar.js");
const { rowTxt } = require("./genres/emit.js");
const T = require(ROOT + "/nukernel/genres-tables.js");
const K = require(ROOT + "/nukernel/kernel.js");
const NG = require(ROOT + "/nukernel/genres.js");
const NSong = require(ROOT + "/nukernel/song.js");

const { FIGURES, MODES, SCALES } = T;
const PCN = Mine.PCN;

/* THE CATALOGUE'S OWN TEMPO WINDOW, computed rather than typed: the 2nd and
   98th percentiles of the 482 rows' declared bpm. A mined tempo outside it is
   an octave error in the notation, not a record nobody has ever made — and the
   numbers move when the table does, which is what computing them buys. */
const BPM_LO = (() => { const b = Object.values(NG.GENRES).map((g) => g.bpm).filter(Boolean).sort((x, y) => x - y);
                        return b[Math.floor(0.02 * b.length)]; })();
const BPM_HI = (() => { const b = Object.values(NG.GENRES).map((g) => g.bpm).filter(Boolean).sort((x, y) => x - y);
                        return b[Math.floor(0.98 * b.length)]; })();

/* ---------------------------------------------------------------------------
   THE PRINTER. Every step says what it decided and how sure it is; `--dry`
   changes nothing about this, only about whether anything is written.
   --------------------------------------------------------------------------- */
const LOG = [];
function say(s) { LOG.push(s); console.log(s); }
function decide(step, what, value, conf, why) {
  const c = conf == null ? "  —  " : (conf >= 0.999 ? "1.00" : conf.toFixed(2));
  say(`  ${String(step).padEnd(9)} ${String(what).padEnd(14)} ${String(value).padEnd(26)} conf ${c}  ${why}`);
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mode1 = (a) => {                       // the modal value, ties to the smallest
  const c = new Map();
  for (const x of a) c.set(x, (c.get(x) || 0) + 1);
  let best = null, bn = -1;
  for (const [k, n] of [...c.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1)))
    if (n > bn) { bn = n; best = k; }
  return { v: best, n: bn, of: a.length };
};

/* ===========================================================================
   1 · READ — mine-midi's parser, and the metric level checked before a bpm is
   believed.
   ======================================================================== */
function read(file) {
  const parsed = Mine.parseSmf(fs.readFileSync(file));
  if (!parsed.notes.length) throw new Error(file + ": parsed, but it has no notes");
  const feat = Mine.featuresOf(parsed);
  const det = Mine.detectKey(parsed);
  const ts = parsed.timeSigs[0] || { nn: 4, den: 4 };
  const barLen = ts.nn * (4 / ts.den);            // in quarter-note beats
  const notated = feat.bpm;

  /* THE RAGTIME LESSON, made measurable, AND IT IS THE ONE PLACE THIS TOOL IS
     ALLOWED TO OVERRULE THE FILE. mine-midi.js's own caveat: "NOTATION TEMPO is
     a convention, not a truth: dub/reggae MIDI is written double-time (corpus
     134 = anchor 67), and 2/4-notated corpora (ragtime, marches) read HALF as
     fast as they feel". So there are exactly two moves and both are argued:

       · A 2/4 OR 2/2 NOTATION names a HALF-BAR, not the felt beat — that IS the
         stated caveat, and it is why the ragtime anchor's first press was slow.
         Factor 2, by the caveat, and nothing else.
       · A NUMBER OUTSIDE THE CATALOGUE'S OWN WINDOW is folded by octaves until
         it is inside. The window is `BPM_LO`..`BPM_HI` below — the 2nd and 98th
         percentiles of the 482 rows this table already holds, not a number
         somebody liked. A record at 268 is a record written double-time; a
         record at 34 is written half.

     The METRIC LEVEL — the modal inter-onset interval of the lowest fifth of
     the pitches — is measured and PRINTED as corroboration, and it does not
     drive the answer, because a bass playing eighths at a perfectly ordinary
     tempo is not evidence of anything and an earlier draft of this function
     doubled every rock record on exactly that mistake. */
  const pitched = parsed.notes.filter((n) => n.ch !== 9);
  const lowCut = pitched.length
    ? (() => { const p = pitched.map((n) => n.pitch).sort((a, b) => a - b);
               return p[Math.floor(p.length / 5)]; })() : 60;
  const low = pitched.filter((n) => n.pitch <= lowCut);
  const pool = (low.length >= 12 ? low : pitched).map((n) => Math.round(n.beat * 4) / 4)
    .sort((a, b) => a - b);
  const iois = [];
  for (let i = 1; i < pool.length; i++) { const d = pool[i] - pool[i - 1]; if (d > 0) iois.push(d); }
  const lvl = mode1(iois.map((d) => (d <= 0.375 ? 0.25 : d <= 0.75 ? 0.5 : d < 1.75 ? 1 : d < 3.5 ? 2 : 4)));
  const halfBar = (ts.nn === 2 && (ts.den === 4 || ts.den === 2));
  let factor = 1, why = `the notated quarter is taken as the felt beat (the lowest fifth moves in ${lvl.v}-beat steps, ${((lvl.n / Math.max(1, lvl.of)) * 100).toFixed(0)}% of the time)`;
  if (halfBar) { factor = 2; why = `notated ${ts.nn}/${ts.den} — mine-midi's stated caveat: a 2/4 stride or march reads HALF as fast as it feels`; }
  let felt = notated * factor, folded = 0;
  while (felt > BPM_HI) { felt /= 2; folded--; }
  while (felt < BPM_LO) { felt *= 2; folded++; }
  if (folded) why += `; folded ${folded > 0 ? "up" : "down"} ${Math.abs(folded)} octave${Math.abs(folded) === 1 ? "" : "s"} into the catalogue's own ${BPM_LO}..${BPM_HI} window`;
  const lvlConf = lvl.of ? lvl.n / lvl.of : 0;

  /* the meter, in the box's own three words. `kernel.js METERS` holds exactly
     `three` (3/4) and `six` (6/8); everything else counts in four, and a file
     in 5/8 or 7/4 is TOLD it is being counted in four rather than being given a
     word the box does not have. */
  const abc = `${ts.nn}/${ts.den}`;
  const meter = (ts.nn === 3 && ts.den === 4) ? "three"
    : (ts.nn === 6 && ts.den === 8) ? "six" : null;
  const meterSayable = meter != null || (ts.den === 4 && (ts.nn === 4 || ts.nn === 2)) ||
                       (ts.den === 2 && ts.nn === 2);
  const N = K.stepsIn({ meter });                 // steps in one bar: 16 or 12

  return { file, parsed, feat, det, ts, abc, barLen, meter, meterSayable, N,
           notated, felt: Math.round(felt), factor, metricWhy: why, lvlConf,
           keyConf: clamp(det.margin / 0.15, 0, 1) };
}

/* ===========================================================================
   2 · ARRANGE — bars compared to each other, and the repeats become the form.
   ======================================================================== */
/** one bar's fingerprint: 12 pitch-class weights and 16 onset-slot weights,
 *  each L2-normalised so the two halves weigh the same however dense the bar. */
function barVec(notes, s, e, N) {
  const pc = new Float64Array(12), on = new Float64Array(N);
  for (const n of notes) {
    const ov = Math.min(e, n.beat + n.dur) - Math.max(s, n.beat);
    if (ov <= 0) continue;
    if (n.ch !== 9) pc[n.pitch % 12] += ov * (n.vel / 127);
    if (n.beat >= s && n.beat < e) {
      const slot = clamp(Math.round((n.beat - s) / (e - s) * N), 0, N - 1);
      on[slot] += n.vel / 127;
    }
  }
  const norm = (a) => { const m = Math.sqrt(sum([...a].map((x) => x * x))); return m ? [...a].map((x) => x / m) : [...a]; };
  return norm(pc).concat(norm(on));
}
const cos = (a, b) => {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? d / Math.sqrt(x * y) : 0;
};

const ROLE_WORDS = ["intro", "verse", "chorus", "bridge", "outro"];

function arrange(R) {
  const { parsed, barLen, N } = R;
  const t0 = Math.min(...parsed.notes.map((n) => n.beat));
  const nBars = Math.max(1, Math.ceil((parsed.totalBeats) / barLen));
  const vecs = [];
  for (let b = 0; b < nBars; b++) vecs.push(barVec(parsed.notes, t0 + b * barLen, t0 + (b + 1) * barLen, N));
  const live = vecs.map((v) => v.some((x) => x !== 0));

  /* THE THRESHOLD IS THE FILE'S OWN, not a constant somebody liked. Two bars
     are "the same bar" above the 75th percentile of this file's off-diagonal
     similarities, clamped into [0.70, 0.92] so that a through-composed piece
     (whose 75th percentile is low) cannot declare everything identical and a
     one-riff loop (whose is ~1) cannot declare everything distinct. */
  const offs = [];
  for (let i = 0; i < nBars; i++) for (let j = i + 1; j < nBars; j++)
    if (live[i] && live[j]) offs.push(cos(vecs[i], vecs[j]));
  offs.sort((a, b) => a - b);
  const p75 = offs.length ? offs[Math.floor(0.75 * offs.length)] : 0.8;
  const Tsim = clamp(+p75.toFixed(3), 0.70, 0.92);

  // first-fit clustering: a bar joins the first cluster whose FIRST member it
  // matches. Deterministic and order-preserving, which is what makes the labels
  // a description of the piece's own sequence.
  const heads = [], label = [];
  for (let b = 0; b < nBars; b++) {
    if (!live[b]) { label.push(-1); continue; }
    let hit = -1;
    for (let h = 0; h < heads.length; h++) if (cos(vecs[b], vecs[heads[h]]) >= Tsim) { hit = h; break; }
    if (hit < 0) { heads.push(b); hit = heads.length - 1; }
    label.push(hit);
  }

  // runs of one label become blocks; a run shorter than two bars is folded into
  // the block before it (a single odd bar is a turnaround, not a section).
  const runs = [];
  for (let b = 0; b < nBars; b++) {
    const last = runs[runs.length - 1];
    if (last && last.c === label[b]) last.bars++;
    else runs.push({ c: label[b], from: b, bars: 1 });
  }
  const blocks = [];
  for (const r of runs) {
    if (r.bars < 2 && blocks.length) { blocks[blocks.length - 1].bars += r.bars; continue; }
    blocks.push({ ...r });
  }
  if (!blocks.length) blocks.push({ c: 0, from: 0, bars: nBars });
  /* A FORM IS CAPPED AT TWELVE SECTIONS, and the cap is the box's own: the
     longest arrangement `compose.js PLANS` deals is eleven roles. A 130-bar dub
     plate came out of the first draft as eighteen sections, which is not a form
     — it is a list of bars. So while there are more than twelve, the SHORTEST
     block is folded into whichever neighbour it is more like, and the row's
     note carries the count that was folded away. */
  let folded = 0;
  while (blocks.length > 12) {
    let sm = 0;
    for (let i = 1; i < blocks.length; i++) if (blocks[i].bars < blocks[sm].bars) sm = i;
    const into = sm === 0 ? 1 : sm === blocks.length - 1 ? sm - 1
      : (blocks[sm - 1].bars <= blocks[sm + 1].bars ? sm - 1 : sm + 1);
    blocks[into].bars += blocks[sm].bars;
    blocks[into].from = Math.min(blocks[into].from, blocks[sm].from);
    blocks.splice(sm, 1);
    folded++;
  }

  /* THE NAMES, AND THEY ARE GUESSES (docs/REMIX.md step 2, verbatim): the first
     distinct block is the intro, the most repeated is the chorus, what returns
     between choruses is the verse, what appears once late is the bridge. What
     the contract does not name and this adds: a block that appears once AT THE
     END is an outro, because "once, late" describes both and the last one is
     the one everybody calls an outro. */
  const count = new Map();
  for (const bl of blocks) count.set(bl.c, (count.get(bl.c) || 0) + 1);
  let chorusC = null, cn = -1;
  for (const [c, n] of [...count.entries()].sort((a, b) => a[0] - b[0]))
    if (n > cn) { cn = n; chorusC = c; }
  const sections = blocks.map((bl, i) => {
    const once = count.get(bl.c) === 1;
    let role;
    if (i === 0 && (once || blocks.length > 1)) role = "intro";
    else if (bl.c === chorusC && cn > 1) role = "chorus";
    else if (once && i === blocks.length - 1) role = "outro";
    else if (once && i > blocks.length / 2) role = "bridge";
    else role = "verse";
    return { role, bars: bl.bars, from: bl.from, c: bl.c };
  });
  // the intro is only an intro if something follows it
  if (sections.length === 1) sections[0].role = "verse";

  /* THE CONFIDENCE OF A FORM is how far the within-cluster similarity sits
     above the between-cluster similarity — a piece that repeats has a wide gap,
     a through-composed piece has none, and a form claimed off no gap is a form
     nobody should believe. */
  let wIn = [], wOut = [];
  for (let i = 0; i < nBars; i++) for (let j = i + 1; j < nBars; j++) {
    if (!live[i] || !live[j]) continue;
    (label[i] === label[j] ? wIn : wOut).push(cos(vecs[i], vecs[j]));
  }
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const gap = mean(wIn) - mean(wOut);
  return { nBars, Tsim, label, heads, blocks, sections, gap, folded,
           conf: clamp(gap / 0.35, 0, 1), clusters: heads.length,
           t0, repeats: cn };
}

/* ===========================================================================
   3 · EXTRACT MOTIFS — the melody becomes the box's own cells, the drums a kit
   grid, the bass its own figure. Deduplicated BY SHAPE, not by exact match.
   ======================================================================== */

/** WHICH LINE IS THE MELODY, and it is a guess (honesty 3). Parts are the
 *  file's own tracks where it has more than one, else its channels; the melody
 *  is the part with the highest mean pitch that carries enough notes to be a
 *  line at all. The margin over the runner-up is the confidence. */
function partsOf(parsed) {
  const by = new Map();
  for (const n of parsed.notes) {
    if (n.ch === 9) continue;
    const k = n.ch;
    (by.get(k) || by.set(k, []).get(k)).push(n);
  }
  const parts = [...by.entries()].map(([ch, notes]) => {
    const ps = notes.map((n) => n.pitch);
    // MONOPHONY: the fraction of onsets that are alone at their own onset time.
    const at = new Map();
    for (const n of notes) at.set(n.beat, (at.get(n.beat) || 0) + 1);
    const mono = [...at.values()].filter((c) => c === 1).length / at.size;
    const pgm = parsed.programs.filter((p) => p.ch === ch);
    return { ch, notes, n: notes.length, mean: sum(ps) / ps.length,
             hi: Math.max(...ps), mono, pgm: pgm.length ? pgm[0].pgm : null };
  }).filter((p) => p.n >= 8);
  /* THE SCORE IS HEIGHT TIMES SINGLENESS, and the second half is what an
     earlier draft was missing: a dub plate's highest CHANNEL was a chord pad,
     0% monophonic, and it was handed to the phrase slicer as the tune. Height
     is taken as a rank among this file's own parts so the two halves are
     comparable; both are printed. */
  const hi = Math.max(...parts.map((p) => p.mean)), lo = Math.min(...parts.map((p) => p.mean));
  for (const p of parts) p.score = (hi > lo ? (p.mean - lo) / (hi - lo) : 1) * (0.25 + 0.75 * p.mono);
  parts.sort((a, b) => b.score - a.score || b.mean - a.mean || a.ch - b.ch);
  return parts;
}

/** the file's skyline, for the case where everything is on one channel (a solo
 *  piano transcription — mine-melody.js states this caveat for the same case).
 *  The window slicer already takes the top note per onset, so this is only the
 *  decision of WHICH notes are offered to it. */
function melodyLine(parsed, parts) {
  if (parts.length >= 2) {
    const margin = parts[0].score - parts[1].score;
    return { notes: parts[0].notes, part: parts[0],
             conf: clamp(margin / 0.25, 0, 1),
             why: `channel ${parts[0].ch}, score ${parts[0].score.toFixed(2)} vs ` +
                  `${parts[1].score.toFixed(2)} next — mean pitch ${parts[0].mean.toFixed(1)}, ` +
                  `${(parts[0].mono * 100) | 0}% monophonic` };
  }
  const all = parsed.notes.filter((n) => n.ch !== 9);
  return { notes: all, part: parts[0] || null, conf: 0.25,
           why: "one part only — the SKYLINE is being taken for the melody, " +
                "which is right for a solo-piano transcription and wrong for a " +
                "tenor cantus firmus" };
}

/** a mined window becomes a cell: deg / play / vel / acc, plus `alt` where the
 *  file is chromatic against the chosen mode (document.js toPhrase reads it,
 *  present-only). The OCTAVE is folded away, because `toPhrase` zeroes a cell's
 *  `oct` vector — a fact about the document, printed as thrown away. */
function cellOf(win, { tonic, scale, N, bars, winBeats }) {
  const steps = N * bars;
  const deg = new Array(steps).fill(0);
  const play = new Array(steps).fill("r");
  const vel = new Array(steps).fill(6);
  const acc = new Array(steps).fill(0);
  const alt = new Array(steps).fill(0);
  const vs = win.map((n) => n.vel || 64);
  const vm = sum(vs) / vs.length;
  const vsd = Math.sqrt(sum(vs.map((x) => (x - vm) * (x - vm))) / vs.length);
  let chrom = 0;
  const idx = [];
  for (const n of win) {
    const i = clamp(Math.round(n.o / winBeats * steps), 0, steps - 1);
    if (play[i] === "n") continue;                  // one note per step, first wins
    const pc = ((n.pitch - tonic) % 12 + 12) % 12;
    let d = scale.indexOf(pc), a = 0;
    if (d < 0) {                                    // chromatic: nearest degree + accidental
      let bd = 0, bdist = 99;
      for (let s = 0; s < scale.length; s++) {
        const dist = Math.min(Math.abs(scale[s] - pc), 12 - Math.abs(scale[s] - pc));
        if (dist < bdist) { bdist = dist; bd = s; }
      }
      d = bd; a = pc - scale[bd];
      if (a > 6) a -= 12; if (a < -6) a += 12;
      chrom++;
    }
    deg[i] = d; alt[i] = a; play[i] = "n";
    vel[i] = clamp(Math.round((n.vel || 64) / 127 * 9), 1, 9);
    acc[i] = vsd > 1 && (n.vel || 64) >= vm + 0.5 * vsd ? 1 : 0;
    idx.push({ i, dur: n.dur });
  }
  // the hold: a note runs until the next onset or its own written length
  for (let k = 0; k < idx.length; k++) {
    const stop = k + 1 < idx.length ? idx[k + 1].i : steps;
    const held = clamp(Math.round(idx[k].dur / winBeats * steps), 1, stop - idx[k].i);
    for (let i = idx[k].i + 1; i < idx[k].i + held; i++) play[i] = "h";
  }
  const cell = { kind: "line", deg, play, vel, acc };
  if (alt.some(Boolean)) cell.alt = alt;
  return { cell, chrom, notes: idx.length };
}

/** SHAPE, for the dedup. Two motifs are the same shape when they land on the
 *  same steps and rise and fall in the same places — NOT when their degrees are
 *  equal. A phrase transposed, or one degree different in the middle, is the
 *  same phrase, and dedup by exact match would have kept twelve copies of it. */
function shapeOf(cell) {
  const on = [];
  for (let i = 0; i < cell.play.length; i++) if (cell.play[i] === "n") on.push(i);
  const dir = [];
  for (let k = 1; k < on.length; k++) {
    const d = cell.deg[on[k]] - cell.deg[on[k - 1]];
    dir.push(d > 0 ? "+" : d < 0 ? "-" : "=");
  }
  return on.join(",") + "|" + dir.join("");
}

const CELL_NAMES = ["hook", "answer", "riff", "counter", "topline", "climb", "verseline", "sparse"];

function motifs(R, A, mel, alph) {
  const bars = R.meter ? 2 : 2;                       // a motif is two bars
  const winBeats = R.barLen * bars;
  /* THE CEILING IS THE SKYLINE'S, NOT A NOTE COUNT. mine-melody.js filters a
     window to 4..16 notes BEFORE it skylines it, which is right for the corpus
     scan it was written for and wrong here: a solo-piano ragtime bar carries
     forty notes and every window of Maple Leaf Rag was dropped before the top
     line was taken (that file's own note says dense-run corpora "need more
     headroom", and its CLI takes --max-notes for exactly this). The skyline
     itself cannot produce more than one note per quarter-of-a-beat, so a
     ceiling of four per beat lets every real window through and the arithmetic
     that matters is unchanged. */
  const sigW = Mel.windowsOf(mel.notes, { win: winBeats, minNotes: 3,
                                          maxNotes: Math.ceil(winBeats * 12) });
  const stepMed = (() => {                            // this FILE's own step fraction
    const all = [...sigW.values()].flat();
    if (!all.length) return 0.5;
    const s = all.map((w) => Mel.winStats(w).step).sort((a, b) => a - b);
    return s[s.length >> 1];
  })();
  const ranked = [...sigW.entries()].sort((a, b) => b[1].length - a[1].length ||
                                                    (a[0] < b[0] ? -1 : 1));
  const out = [], seen = new Map();
  for (const [, wins] of ranked) {
    const best = Mel.medoid(wins, stepMed);
    if (!best) continue;
    const c = cellOf(best, { ...alph, N: R.N, bars, winBeats });
    if (c.notes < 3) continue;
    const sh = shapeOf(c.cell);
    if (seen.has(sh)) { seen.get(sh).seen += wins.length; continue; }
    const rec = { name: CELL_NAMES[out.length] || "cell" + out.length, cell: c.cell,
                  seen: wins.length, chrom: c.chrom, notes: c.notes, shape: sh,
                  at: best._win };
    seen.set(sh, rec);
    out.push(rec);
    if (out.length >= CELL_NAMES.length) break;
  }
  return { motifs: out, distinctShapes: seen.size, windows: [...sigW.values()].flat().length,
           stepMed };
}

/* the GM percussion lane letters. `mine-midi.laneFor` is the one owner of GM
   key -> lane NAME and is asked for every hit; this map is the different fact
   of what the ROW's kit alphabet calls that lane (genres-tables.js DRUMNAME
   read backwards). The one refinement: GM 46 is the OPEN hi-hat and laneFor
   deliberately folds it onto `hat` ("lane hat, like the engine's open flag"),
   where the row alphabet has its own letter `o` for it. */
const LANE_LETTER = { kick: "k", snare: "s", hat: "h", tom: "t", crash: "x",
                      ride: "r", clap: "c", rim: "p", perc: "p" };
function kitOf(R) {
  const { parsed, barLen, N } = R;
  const drums = parsed.notes.filter((n) => n.ch === 9);
  if (!drums.length) return { kit: null, conf: 0, why: "no channel-10 notes: this file has no drummer" };
  const t0 = Math.min(...parsed.notes.map((n) => n.beat));
  const barsOf = new Map();
  for (const n of drums) {
    const b = Math.floor((n.beat - t0) / barLen);
    const slot = clamp(Math.round(((n.beat - t0) % barLen) / barLen * N), 0, N - 1);
    const lane = n.pitch === 46 ? "o" : LANE_LETTER[Mine.laneFor(n.pitch)] || "p";
    const g = barsOf.get(b) || barsOf.set(b, {}).get(b);
    (g[lane] = g[lane] || new Array(N).fill(0))[slot] = 1;
  }
  // THE MODAL BAR: the single 16-step lane picture this drummer plays most.
  const sig = new Map();
  for (const [, g] of barsOf) {
    const k = Object.keys(g).sort().map((l) => l + g[l].join("")).join("|");
    (sig.get(k) || sig.set(k, { n: 0, g }).get(k)).n++;
  }
  const ranked = [...sig.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  const top = ranked[0][1];
  return { kit: top.g, conf: clamp(top.n / barsOf.size / 0.5, 0, 1),
           why: `the modal bar of ${barsOf.size}, played ${top.n} times ` +
                `(${Object.keys(top.g).sort().join("")})` };
}

const BASS_STYLES = [["pedal", 0.25], ["octaves", 0.5], ["walk", 1], ["eighths", 2], ["sixteenths", 4]];
function bassOf(R) {
  const { parsed, barLen, N } = R;
  const pitched = parsed.notes.filter((n) => n.ch !== 9);
  if (!pitched.length) return { grid: null, style: null, conf: 0, why: "no pitched notes" };
  const ps = pitched.map((n) => n.pitch).sort((a, b) => a - b);
  const cut = ps[Math.floor(ps.length * 0.2)];
  const low = pitched.filter((n) => n.pitch <= cut);
  if (low.length < 8) return { grid: null, style: null, conf: 0, why: "the bottom fifth is only " + low.length + " notes — no bass line to read" };
  const t0 = Math.min(...parsed.notes.map((n) => n.beat));
  const barsOf = new Map();
  for (const n of low) {
    const b = Math.floor((n.beat - t0) / barLen);
    const slot = clamp(Math.round(((n.beat - t0) % barLen) / barLen * N), 0, N - 1);
    (barsOf.get(b) || barsOf.set(b, new Array(N).fill(0)).get(b))[slot] = 1;
  }
  const sig = new Map();
  for (const g of barsOf.values()) { const k = g.join(""); (sig.get(k) || sig.set(k, { n: 0, g }).get(k)).n++; }
  const ranked = [...sig.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  const grid = ranked[0][1].g;
  const per = sum(grid) / barLen;                // onsets per BEAT
  let style = "pedal";
  for (const [nm, thr] of BASS_STYLES) if (per >= thr) style = nm;
  return { grid, style, per: +per.toFixed(2),
           conf: clamp(ranked[0][1].n / barsOf.size / 0.4, 0, 1),
           why: `${low.length} notes under MIDI ${cut}; modal bar played ` +
                `${ranked[0][1].n} of ${barsOf.size} times, ${per.toFixed(2)} onsets/beat` };
}

/* ===========================================================================
   THE ALPHABET — which of the box's own modes and scales this file speaks.
   ======================================================================== */
/* THE CANDIDATE LIST IS IN THE CATALOGUE'S OWN ORDER OF USE, and the order is a
   tie-break, not a thumb on the scale: measured over the 482 rows on
   2026-09-06, `mode`/`scale` name ionian 261 times, aeolian 104, dorian 79,
   mixo 59, phrygian 53, majpent 38, harmonic 27, blues 24, hijaz 10, melodic 7,
   lydian 5, yupent 2, locrian 0. Two alphabets that fit this file within a
   thousandth are not distinguishable BY this file, so the commoner one wins and
   the confidence — which is the margin — says how little was decided. Without
   this a plain I-IV-V-I record came back mixolydian on a 0.001 lead. */
const ALPH_CANDIDATES = () => {
  const out = [];
  for (const k of ["ionian", "aeolian", "dorian", "mixo", "phrygian", "harmonic",
                   "hijaz", "melodic", "lydian", "phrygiandom", "locrian"])
    if (MODES[k]) out.push({ table: "MODES", key: k, pcs: MODES[k] });
  for (const k of ["majpent", "blues", "yupent"])
    if (SCALES[k]) out.push({ table: "SCALES", key: k, pcs: SCALES[k] });
  /* DEDUPED BY CONTENT, first spelling wins. `SCALES.major` and `MODES.ionian`
     are the same seven numbers, and offering both made every major-key file's
     alphabet decision a tie at confidence zero — a confidence that was
     reporting a fact about this list rather than about the music. */
  const seen = new Set(), uniq = [];
  for (const c of out) { const k = c.pcs.join(","); if (seen.has(k)) continue; seen.add(k); uniq.push(c); }
  return uniq;
};
function alphabetOf(R) {
  const w = new Float64Array(12);
  for (const n of R.parsed.notes) if (n.ch !== 9) w[n.pitch % 12] += n.dur * (n.vel / 127);
  const tot = sum([...w]) || 1;
  /* THE KEY SIGNATURE IS BELIEVED ONLY WHERE THE DETECTOR AGREES, and the
     reason is measured rather than theoretical: mine-midi's own `keycheck`
     command exists precisely because an embedded signature and a detected key
     disagree often, and A DEFAULT C SIGNATURE IS THE COMMONEST LIE IN A MIDI
     FILE — a sequencer writes sf=0 whether or not anybody set a key. Maple Leaf
     Rag came out of this trove claiming C and rendered in phrygian on it.
     So: the signature wins when it is the detector's key, its relative, or a
     fifth away (keycheck's own three categories); otherwise the detector wins
     and the row's note says which and why. */
  const sig = R.parsed.keySigs.length ? R.parsed.keySigs[0] : null;
  const sigT = sig ? Mine.keySigTonic(sig.sf, sig.mi) : null;
  const sigM = sig ? (sig.mi ? "minor" : "major") : null;
  const agrees = sig && (
    (sigT === R.det.tonic && sigM === R.det.mode) ||
    (sigM !== R.det.mode && R.det.tonic === (sigM === "major" ? (sigT + 9) % 12 : (sigT + 3) % 12)) ||
    (sigM === R.det.mode && (R.det.tonic === (sigT + 7) % 12 || R.det.tonic === (sigT + 5) % 12)));
  const tonic = agrees ? sigT : R.det.tonic;
  const from = agrees ? "the file's own key signature, corroborated by Krumhansl-Kessler"
    : sig ? `Krumhansl-Kessler — the file's signature says ${PCN[sigT]} ${sigM} and the detector says ` +
            `${PCN[R.det.tonic]} ${R.det.mode}, which is not it, its relative or a fifth away, so the ` +
            `signature is being read as a sequencer default`
    : "Krumhansl-Kessler over the whole file (the file carries no key signature)";
  const rot = Array.from({ length: 12 }, (_, i) => w[(tonic + i) % 12] / tot);
  /* THE THIRD IS NOT NEGOTIABLE. The mode the key came with — the signature's
     where the signature was believed, the detector's otherwise — has already
     committed to a major or a minor third, and an alphabet that contradicts it
     is answering a different question. Without this, a C minor dub plate came
     back on SCALES.majpent because a pentatonic mask fits almost any profile.
     A blues alphabet counts as minor (it carries the flat third and the fourth
     the mode does not), which is the one honest straddle in the list. */
  const third = (agrees ? sigM : R.det.mode) === "minor" ? 3 : 4;
  const scored = ALPH_CANDIDATES().filter((c) => c.pcs.includes(third)).map((c) => {
    /* THE FIT IS A COSINE AGAINST THE ALPHABET'S OWN MASK, which is the one
       measure that is punished in BOTH directions: a note the file plays and
       the alphabet cannot say pulls it down, and a degree the alphabet declares
       and the file never touches pulls it down too. An earlier draft scored
       coverage-minus-waste and put Maple Leaf Rag in phrygian, because coverage
       alone rewards any alphabet that happens to contain the loud notes. */
    const mask = new Array(12).fill(0);
    for (const d of c.pcs) mask[d] = 1;
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < 12; i++) { dot += rot[i] * mask[i]; ma += rot[i] * rot[i]; mb += mask[i] * mask[i]; }
    const fit = ma && mb ? dot / Math.sqrt(ma * mb) : 0;
    let cov = 0;
    for (const d of c.pcs) cov += rot[d];
    return { ...c, cov, fit, score: +fit.toFixed(3) };
  }).map((c, i) => ({ ...c, ord: i }))
    .sort((a, b) => b.score - a.score || a.ord - b.ord);
  const best = scored[0], next = scored[1];
  /* `mode` AND `scale` ARE TWO DIFFERENT FIELDS AND ONLY ONE OF THEM MAY BE A
     SCALE. precompose.js throws by name on "a mode no MODES key names": `mode`
     is the harmonic alphabet the chords are built out of and it has to be one
     of the MODES; `scale` is the SUBJECT's alphabet and may be a pentatonic or
     a blues scale. So the fit is read twice off the same ranking — the best
     answer overall becomes `scale`, and the best answer that is a MODE becomes
     `mode` — which is exactly the shape the catalogue's own pentatonic rows
     take (a majpent subject over an ionian harmony). */
  const bestMode = scored.find((c) => c.table === "MODES") || best;
  return { tonic, from, sig, sigT, sigM, agrees, scale: best.pcs, name: best.key, table: best.table,
           mode: bestMode.pcs, modeName: bestMode.key,
           cov: best.cov, fit: best.fit,
           conf: clamp((best.score - next.score) / 0.04, 0, 1) * clamp(best.cov / 0.9, 0, 1),
           runners: scored.slice(0, 3).map((s) => `${s.key} fit ${s.fit.toFixed(2)}/says ${(s.cov * 100).toFixed(0)}%`) };
}

/* ===========================================================================
   4 · EXTRACT THE CHANGES — per-bar estimates become a `prog` in DEGREES.
   ======================================================================== */
function changes(R, alph, A) {
  const { bars } = Mine.chordsOf(R.parsed);
  if (!bars.length) return { roots: null, prog: null, conf: 0, why: "no pitched weight to estimate a chord from" };
  // a ROOT is a degree of the harmonic alphabet, which is the MODE — a chord
  // rooted on a note the subject's pentatonic does not carry is still a chord
  const scale = alph.mode;
  const deg = new Map();
  for (const b of bars) {
    const pc = ((b.root - alph.tonic) % 12 + 12) % 12;
    let d = scale.indexOf(pc), snapped = false;
    if (d < 0) {
      let bd = 0, bdist = 99;
      for (let s = 0; s < scale.length; s++) {
        const dist = Math.min(Math.abs(scale[s] - pc), 12 - Math.abs(scale[s] - pc));
        if (dist < bdist) { bdist = dist; bd = s; }
      }
      d = bd; snapped = true;
    }
    deg.set(b.bar, { d, seventh: b.seventh, snapped });
  }
  /* THE CYCLE IS THE MOST REPEATED BLOCK'S OWN BARS. A record's changes are the
     changes of the thing that comes back, not of the whole file — reading a
     four-bar loop off a 96-bar piece's first four bars would be reading its
     introduction. */
  const chorus = A.sections.find((s) => s.role === "chorus") ||
                 A.sections.find((s) => s.role === "verse") || A.sections[0];
  const len = clamp(chorus.bars, 2, 12);
  const roots = [], q = [];
  let snaps = 0, have = 0;
  for (let i = 0; i < len; i++) {
    const e = deg.get(chorus.from + i);
    if (e) { roots.push(e.d); q.push(e.seventh); have++; if (e.snapped) snaps++; }
    else { roots.push(roots.length ? roots[roots.length - 1] : 0); q.push(false); }
  }
  const sev = q.filter(Boolean).length / len;
  /* THE PROG'S FIRST-CHORD DEGREES EQUAL THE ROOTS BAR FOR BAR — genres-tables
     PROGS's own law, quoted rather than re-derived. The only thing prog adds
     over roots is the SEVENTH, and it is written only where the estimate found
     one on more than half the bars, because a seventh on one bar of four is an
     accident of a passing note. */
  const prog = sev >= 0.5 ? roots.map((d, i) => (q[i] ? { d, q: "7" } : { d })) : null;
  const distinct = new Set(roots).size;
  return { roots, prog, len, sev, distinct, snaps,
           conf: clamp(have / len, 0, 1) * clamp(1 - snaps / len, 0, 1),
           why: `${have}/${len} bars estimated off ${chorus.role} at bar ${chorus.from}` +
                `, ${snaps} chromatic root${snaps === 1 ? "" : "s"} snapped to the mode` +
                `, ${distinct} distinct degree${distinct === 1 ? "" : "s"}` };
}

/* ===========================================================================
   THE DYNAMIC FIGURE — MEASURED against FIGURES, not guessed (contract step 5).
   Each figure is asked what it would have written over THIS file's own onsets,
   both sides are z-scored inside the bar (a MIDI velocity has an offset a
   figure's 0..9 does not), and the winner is the smallest mean squared error.
   ======================================================================== */
function figureOf(R, mel) {
  const { barLen, N } = R;
  const t0 = Math.min(...R.parsed.notes.map((n) => n.beat));
  const byBar = new Map();
  for (const n of mel.notes) {
    const b = Math.floor((n.beat - t0) / barLen);
    const i = clamp(Math.round(((n.beat - t0) % barLen) / barLen * N), 0, N - 1);
    const g = byBar.get(b) || byBar.set(b, new Map()).get(b);
    if (!g.has(i) || g.get(i) < n.vel) g.set(i, n.vel);
  }
  const err = {}; let spread = 0, nb = 0;
  for (const name of Object.keys(FIGURES)) err[name] = { se: 0, n: 0 };
  for (const [b, g] of byBar) {
    const at = [...g.keys()].sort((a, b2) => a - b2);
    if (at.length < 3) continue;
    const real = at.map((i) => g.get(i));
    const m = sum(real) / real.length;
    const sd = Math.sqrt(sum(real.map((x) => (x - m) * (x - m))) / real.length);
    spread += sd; nb++;
    if (sd < 1) continue;                        // a flat bar discriminates nothing
    const rz = real.map((x) => (x - m) / sd);
    for (const name of Object.keys(FIGURES)) {
      const F = FIGURES[name];
      const pred = at.map((i, j) => F.vel(j, at.length, i, b, N, at));
      const pm = sum(pred) / pred.length;
      const psd = Math.sqrt(sum(pred.map((x) => (x - pm) * (x - pm))) / pred.length) || 1;
      const pz = pred.map((x) => (x - pm) / psd);
      for (let j = 0; j < rz.length; j++) err[name].se += (rz[j] - pz[j]) * (rz[j] - pz[j]);
      err[name].n += rz.length;
    }
  }
  const meanSd = nb ? spread / nb : 0;
  const scored = Object.entries(err).filter(([, e]) => e.n)
    .map(([k, e]) => ({ k, mse: e.se / e.n })).sort((a, b) => a.mse - b.mse || (a.k < b.k ? -1 : 1));
  /* A FILE WITH NO DYNAMIC DIFFERENTIATION GETS `flat`, AND THAT IS A CLAIM.
     Most sequenced MIDI is velocity-constant; saying `lean` over it would be
     writing a shape the file does not have, which is precisely the "declared
     but never arriving" fault. `flat` is the figure FIGURES reserves for a
     sequenced floor and it is the true answer here. */
  if (!scored.length || meanSd < 3)
    return { name: "flat", conf: clamp(1 - meanSd / 3, 0, 1), table: scored,
             why: `mean within-bar velocity spread ${meanSd.toFixed(1)} — the file's velocities are ` +
                  (meanSd < 1 ? "constant" : "nearly constant") };
  const margin = scored.length > 1 ? scored[1].mse - scored[0].mse : 1;
  return { name: scored[0].k, conf: clamp(margin / 0.3, 0, 1), table: scored,
           why: `mse ${scored[0].mse.toFixed(3)} vs ${scored[1] ? scored[1].k + " " + scored[1].mse.toFixed(3) : "—"}` +
                `, velocity spread ${meanSd.toFixed(1)}` };
}

/* ===========================================================================
   THE INSTRUMENTS — 16 GM FAMILIES, and a family is all a program number is
   honestly worth here (honesty 4). A file with no program changes at all gets
   the box's plainest pair and the note says the timbre was not read.
   ======================================================================== */
const GM_FAMILY = ["yamaha_grand_piano", "vibraphone", "drawbarorgan", "clean_guitar",
                   "picked_bass", "violin", "strings", "brass_section",
                   "tenor_sax", "flute", "saw_wave", "warm_pad",
                   "atmosphere", "banjo", "marimba", "fret_noise"];
const GM_FAMILY_WORD = ["piano", "chromatic percussion", "organ", "guitar", "bass",
                        "strings", "ensemble", "brass", "reed", "pipe", "synth lead",
                        "synth pad", "synth effects", "ethnic", "percussive", "sound effects"];

/* ===========================================================================
   5 · MAKE THE ROW
   ======================================================================== */
function makeRow(R, A, M, kit, bass, alph, ch, fig, mel, parts, opt, prov) {
  const stem = path.basename(R.file).replace(/\.midi?$/i, "");
  const label = opt.label || stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
  const dated = /\d{3,4}\s*$/.test(label);

  const voiceParts = parts.slice(0, 3).filter((p) => p.n >= 8);
  const instr = voiceParts.length
    ? voiceParts.map((p) => (p.pgm == null ? null : GM_FAMILY[p.pgm >> 3])).map((x, i) =>
        x || ["polysynth", "electric_piano", "warm_pad"][i] || "polysynth")
    : ["polysynth", "electric_piano"];
  const voices = clamp(Math.max(2, Math.min(instr.length, M.motifs.length || 2)), 2, 4);
  while (instr.length < voices) instr.push("warm_pad");
  instr.length = voices;

  const plan = kit.kit && kit.kit.k && sum(kit.kit.k) >= (R.N / 4) && A.repeats >= 3 ? "dance"
    : A.blocks.length <= 3 ? "arc" : "song";

  const artic = (() => {
    const on = mel.notes.map((n) => n.beat).sort((a, b) => a - b);
    const rs = [];
    for (let i = 0; i + 1 < on.length; i++) {
      const gap = on[i + 1] - on[i];
      if (gap > 0) rs.push(clamp((mel.notes[i].dur || 0) / gap, 0, 2));
    }
    if (!rs.length) return null;
    const m = Mine.median(rs);
    return m < 0.6 ? "staccato" : m > 0.95 ? "legato" : null;
  })();

  const row = {};
  row.note = noteOf(R, A, M, kit, bass, alph, ch, fig, mel, parts, opt, prov, label, dated);
  row.label = label;
  row.voices = voices;
  row.bars = ch.roots ? ch.roots.length : 4;
  row.plan = plan;
  row.bpm = R.felt;
  /* ...AND THE TEMPO DOES NOT WANDER, for `silence`'s and `dance`'s own reason.
     A mined row's bpm is a MEASUREMENT off a file, not a claim about a night
     people played on, and a give-or-take of 4 around a measurement is noise
     added to a number whose whole value is that it was read rather than
     chosen. */
  row.jitter = 0;
  row.instr = instr;
  if (opt.parents && prov.parents) row.parents = prov.parents;
  row.entry = { kind: "const", n: 0 };
  row.reg = { kind: "neg" };
  row.realize = { kind: "cases", cases: [{ at: 0, then: "line" }], else: "chord" };
  if (ch.roots) row.roots = ch.roots;
  if (kit.kit) row.kit = kit.kit; else { row.kit = {}; }
  row.mode = { $src: `MODES.${alph.modeName}` };
  row.scale = { $src: `${alph.table}.${alph.name}` };
  if (alph.mode.length === 7) row.diatonic = true;
  if (bass.grid) { row.bassStyle = bass.style; row.bassGrid = bass.grid; row.bassInstr = "picked_bass"; }
  else row.nobass = true;
  row.harmony = ch.roots && ch.distinct > 1 ? "cycle" : "modal";
  if (R.meter) row.meter = R.meter;
  if (R.feat.swing >= 0.15) row.swing = +R.feat.swing.toFixed(2);
  if (artic) row.artic = artic;
  if (ch.prog) row.prog = ch.prog;
  /* THE TONE BLOCK IS DECLARED, NOT MEASURED (honesty 4). It is here for one
     thing the record cannot do without: `verb`, which G9a holds to a non-zero
     return on every record. A .mid is silent about timbre and this row says so
     rather than inventing a filter sweep off a transcription. */
  row.tone = { wave: "sawtooth", cut: 2200, q: 1.2, atk: 0.005, rel: 0.5, gain: 0.28, verb: 0.2 };
  row.words = M.motifs.slice(0, voices).map((m, i) =>
    i === 0 ? `the ${m.name}, as measured (${m.notes} notes, seen ${m.seen}x)`
            : `the ${m.name}, ${m.notes} notes, seen ${m.seen}x`);
  while (row.words.length < voices) row.words.push("the chords under it");
  row.word = { kind: "const", n: { $src: "[]" } };
  row.dyn = fig.name;
  return row;
}

/* ---- 6 · SAY WHERE IT CAME FROM ---------------------------------------- */
function noteOf(R, A, M, kit, bass, alph, ch, fig, mel, parts, opt, prov, label, dated) {
  const L = [];
  const nm = label.toUpperCase();
  L.push(`${nm} — MINED FROM ONE MIDI FILE BY tools/remix.js (${STAMP}). Paul: "Could you`);
  L.push(`write an auto remix function that could take a midi file, arrange it, extract`);
  L.push(`motifs, and make it a new genre?" This row is that function's output and it is`);
  L.push(`not a genre: it is one recording, measured. docs/REMIX.md is the contract.`);
  L.push("");
  L.push(`SOURCE. ${path.basename(R.file)} — ${R.parsed.notes.length} notes, ${R.parsed.ntrk} tracks,`);
  L.push(`${R.parsed.ppq} ppq, ${A.nBars} bars, notated ${R.abc} at ${R.notated} bpm.`);
  L.push("");
  L.push("WHAT WAS MEASURED, with the number behind it.");
  L.push(`  · tempo ${R.felt} — the notated ${R.notated} times ${R.factor}, because ${R.metricWhy}.`);
  L.push(`    NOTATION TEMPO IS A CONVENTION (mine-midi.js's own caveat, and the reason the`);
  L.push(`    ragtime anchor's first press was slow): the metric level is checked before a`);
  L.push(`    bpm is believed, and the level here was read at confidence ${R.lvlConf.toFixed(2)}.`);
  L.push(`  · meter ${R.abc}${R.meter ? ` — the box's word "${R.meter}"` : R.meterSayable ? " — counted in four" : " — NOT SAYABLE by this box, which counts it in four and says so"}.`);
  L.push(`  · key ${PCN[alph.tonic]} — ${alph.from}; detector margin ${R.det.margin}. The alphabet is`);
  L.push(`    ${alph.table}.${alph.name} (harmony on MODES.${alph.modeName}), cosine fit ${alph.fit.toFixed(2)} against the pitch-class`);
  L.push(`    profile, saying ${(alph.cov * 100).toFixed(0)}% of its weight (runners-up: ${alph.runners.join(", ")}).`);
  L.push(`  · the kit ${kit.kit ? Object.keys(kit.kit).sort().join("") : "— none"}: ${kit.why}.`);
  L.push(`  · the bass: ${bass.why}${bass.style ? `, read as "${bass.style}"` : ""}.`);
  L.push(`  · swing ${R.feat.swing} in state.swing units (mine-midi measures the median off-beat`);
  L.push(`    displacement and divides by 0.16 — an EQUIVALENT, not a setting somebody chose).`);
  L.push(`  · the dynamic figure "${fig.name}", and it was MEASURED, not guessed: every one of`);
  L.push(`    the nine FIGURES was asked what it would have written over this file's own`);
  L.push(`    onsets and the answers were compared z-scored inside each bar. ${fig.why}.`);
  L.push("");
  L.push("WHAT WAS GUESSED, and each of these is a guess and is printed as one.");
  L.push(`  · THE FORM. ${A.blocks.length} blocks over ${A.clusters} distinct bar-shapes` +
    (A.folded ? ` (${A.folded} short block${A.folded === 1 ? "" : "s"} folded away at the box's own` : ", at a"));
  if (A.folded) L.push(`    twelve-section ceiling), at a`);
  L.push(`    self-similarity threshold of ${A.Tsim} taken from this file's own 75th percentile.`);
  L.push(`    The within/between gap is ${A.gap.toFixed(3)} (confidence ${A.conf.toFixed(2)}). The section NAMES`);
  L.push(`    — ${A.sections.map((s) => s.role).join(" ")} — are an inference from a`);
  L.push(`    twentieth-century pop form onto a file that may not have one: what is measured`);
  L.push(`    is WHERE the music repeats, and "the most repeated block is the chorus" is the`);
  L.push(`    guess laid over it.`);
  L.push(`  · THE MELODY LINE. ${mel.why} — confidence ${mel.conf.toFixed(2)}. "The highest sounding`);
  L.push(`    part" is wrong for a tenor cantus firmus and wrong for a stride left hand.`);
  L.push(`  · THE CHANGES. ${ch.why} — confidence ${ch.conf.toFixed(2)}. mine-midi ESTIMATES a chord`);
  L.push(`    per bar by template match; these are estimates, not an authored progression,`);
  L.push(`    and they are written as DEGREES per the PROGS law, never as chord names.`);
  L.push("");
  L.push("WHAT WAS THROWN AWAY, said out loud.");
  L.push(`  · THE OCTAVE. document.js toPhrase zeroes a cell's \`oct\` vector, so a mined`);
  L.push(`    motif is folded into one octave. The contour survives; the register does not.`);
  L.push(`  · ${M.windows - M.distinctShapes} of ${M.windows} melodic windows, deduplicated BY SHAPE (same onsets, same`);
  L.push(`    rise and fall) rather than by exact match — ${M.distinctShapes} distinct shapes, ${M.motifs.length} kept.`);
  L.push(`  · TIMBRE AND PRODUCTION. ${R.parsed.programs.length} program changes are in the file and only`);
  L.push(`    the 16 GM FAMILIES are read off them, because a program number is the`);
  L.push(`    TRANSCRIBER's choice of patch. The \`tone\` block is DECLARED, not measured: a`);
  L.push(`    .mid says nothing about a filter, a room, a tape or a desk.`);
  L.push(`  · every part below the top ${parts.length > 3 ? 3 : parts.length} of ${parts.length}, and every velocity nuance the`);
  L.push(`    box's 0..9 written level cannot hold.`);
  L.push("");
  if (dated && opt.parents && prov.parents) {
    L.push(`PARENTS, AND A HUMAN SUPPLIED THE ADDRESS. The label "${label}" was given on the`);
    L.push(`command line by somebody who knows where this file came from; the weights below`);
    L.push(`are the fit tool's own NNLS over the catalogue's 27-feature space, rescaled onto`);
    L.push(`the 0.05 grid and capped at 1. Residue ${(prov.residue * 100).toFixed(0)}% — that is what this record`);
    L.push(`invented against the ancestors it names.`);
  } else {
    L.push(`NO PARENTS, AND THAT IS THE HONEST ANSWER, NOT A GAP. genres-build G2 holds that`);
    L.push(`a label is a "Place Year" IF AND ONLY IF a row declares parents, and a MIDI file`);
    L.push(`names neither a place nor a year. Inventing one would be this catalogue's first`);
    L.push(`invented address, so this row takes a plain label and declares no ancestry — the`);
    L.push(`same shape \`silence\`, \`dance\`, \`pop\` and \`guitarrock\` take, for a related reason.`);
    L.push(`What the fit tool DOES say is a measurement and is kept here as one: this row's`);
    L.push(`feature vector is nearest to ${prov.near.map((x) => `${x.key} (${x.d.toFixed(3)})`).join(", ")},`);
    L.push(`and fitted against those it leaves a residue of ${(prov.residue * 100).toFixed(0)}% (r2 ${prov.r2.toFixed(3)}). Give`);
    L.push(`tools/remix.js a real \`--label "Place Year"\` and it will write those parents.`);
  }
  return L.join("\n");
}
const STAMP = "2026-09-06";

/* ===========================================================================
   THE SESSION DOCUMENT — precompose builds a legal record from the row, then
   the MEASURED form and the MEASURED motifs are written into it. That order is
   deliberate: everything the box needs to open a document is precompose's, and
   what this tool has to say is only material and form.
   ======================================================================== */
function sessionOf(key, row, R, A, M, kit, seed) {
  const P2 = require(ROOT + "/nukernel/precompose.js");
  const Doc = require(ROOT + "/nukernel/document.js");
  const { GENRES } = NG;
  const had = Object.prototype.hasOwnProperty.call(GENRES, key);
  const prev = GENRES[key];
  GENRES[key] = resolveRow(row);
  let d;
  try { d = P2.genreToDocument(key, seed); }
  finally { if (had) GENRES[key] = prev; else delete GENRES[key]; }

  // ---- the measured motifs replace the record's line cells
  const cells = d.material.cells;
  const lineNames = Object.keys(cells).filter((n) => cells[n].kind !== "drum");
  const drumNames = Object.keys(cells).filter((n) => cells[n].kind === "drum");
  const mine = M.motifs;
  for (let i = 0; i < lineNames.length; i++)
    cells[lineNames[i]] = JSON.parse(JSON.stringify(mine[i % mine.length].cell));
  if (kit.kit && drumNames.length) {
    const lanes = {};
    for (const l of Object.keys(kit.kit).sort()) lanes[l] = kit.kit[l].slice();
    for (const n of drumNames) cells[n] = { kind: "drum", lanes: JSON.parse(JSON.stringify(lanes)) };
  }

  // ---- the measured form replaces the record's sections, and the CLUSTER a
  // section belongs to decides which motif plays in it: the form the tool found
  // is the form you hear.
  const roles = A.sections.map((s, i) => ({ id: "s" + i, role: s.role, bars: clamp(s.bars, 1, 16) }));
  const oldFirst = d.form.sections[0] || {};
  d.form.sections = roles.map((r, i) => ({ ...r,
    ...(i === 0 && oldFirst.intro ? { intro: oldFirst.intro } : {}) }));
  const byCluster = new Map();
  A.sections.forEach((s, i) => { if (!byCluster.has(s.c)) byCluster.set(s.c, byCluster.size); });
  for (const v of d.voices) {
    const mat = {}, dev = {};
    const off = d.voices.indexOf(v);
    A.sections.forEach((s, i) => {
      const mi = (byCluster.get(s.c) + off) % lineNames.length;
      mat["s" + i] = lineNames[mi];
      dev["s" + i] = "as written";
    });
    mat[""] = lineNames[off % lineNames.length];
    v.material = mat; v.development = dev;
  }
  Doc.normalize(d);
  return d;
}

/** the row as the CATALOGUE would hold it: `{$src}` escapes resolved against
 *  the real tables and the four closures compiled — the same trip
 *  tools/genres/build.js takes, run in memory so a row can be composed before
 *  anybody decides to keep it. */
function resolveRow(row) {
  const { emit } = require("./genres/grammar.js");
  const out = {};
  const T2 = T;
  for (const [k, v] of Object.entries(row)) {
    if (["entry", "reg", "realize", "word", "throat"].includes(k)) {
      // eslint-disable-next-line no-eval
      out[k] = eval("(" + emit(v) + ")");
    } else out[k] = deSrc(v, T2);
  }
  // the four stamp passes the shipped file runs over every row
  const stamped = { ...out };
  const D = { rate: 1, bars: 4, harmony: "cycle", voices: 2 };
  for (const f of Object.keys(D)) if (stamped[f] == null) stamped[f] = D[f];
  if (stamped.dyn && FIGURES[stamped.dyn]) stamped.dynFigure = FIGURES[stamped.dyn];
  return stamped;
}
function deSrc(v, T2) {
  if (Array.isArray(v)) return v.map((x) => deSrc(x, T2));
  if (v && typeof v === "object") {
    if (typeof v.$src === "string") {
      const m = /^(\w+)\.(\w+)$/.exec(v.$src);
      if (m && T2[m[1]] && T2[m[1]][m[2]] !== undefined) return T2[m[1]][m[2]];
      // eslint-disable-next-line no-eval
      return eval("(" + v.$src + ")");
    }
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = deSrc(x, T2); return o;
  }
  return v;
}

/** the store shape ui/state.js writes and adoptSong reads. The boxes name the
 *  row's key, so the session opens once the row is installed — the three
 *  motions GENRES.md §1 names. */
function storeOf(key, row, doc, seed) {
  const bars = doc.form.sections.map((s) => s.bars);
  /* THE BOX IS `song.js emptyBox()`, NOT A HAND-MADE OBJECT. A box carries
     eleven fields this tool has no opinion about — `nudge` among them — and
     validateSong refuses a box that is missing one by name. Building the box
     out of its own module's constructor is the same "one owner" rule the rest
     of this file keeps, and it is what a written-by-hand session file got
     wrong first time. */
  const song = doc.form.sections.map((s) => {
    const b = NSong.emptyBox();
    b.stack = [{ g: key, slots: [0] }];
    b.len = clamp(s.bars, 1, 16);
    b.role = s.role;                 // the form this tool FOUND, on the box
    return b;
  });
  const slots = [JSON.parse(JSON.stringify({ ...NSong.blank(), ...T.DEFAULT }))];
  return { v: NSong.VERSION, slots, song, bpm: row.bpm, doc, _remix: { key, seed, bars } };
}

/* ===========================================================================
   THE CLI
   ======================================================================== */
function main(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (!file) {
    console.error("usage: node tools/remix.js <file.mid> [--name <key>] [--seed n] " +
                  "[--out <dir>] [--label \"Place Year\"] [--dry] [--install] [--json <p>]");
    process.exit(1);
  }
  const O = {
    name: opt("--name", null),
    seed: +opt("--seed", 1) || 1,
    out: opt("--out", path.join(ROOT, "tools/remix-out")),
    label: opt("--label", null),
    dry: argv.includes("--dry"),
    install: argv.includes("--install"),
    json: opt("--json", null),
  };
  O.parents = !!(O.label && /\d{3,4}\s*$/.test(O.label));
  const key = (O.name || "remix" + path.basename(file).replace(/\.midi?$/i, ""))
    .toLowerCase().replace(/[^a-z0-9]/g, "");
  return run(file, key, O);
}

function run(file, key, O) {
  say(`remix ${path.basename(file)} -> ${key}${O.dry ? "  (--dry: nothing will be written)" : ""}`);
  say("  step      what           decided                    conf  why");

  // 1 · READ
  const R = read(file);
  decide(1, "tempo", `${R.felt} bpm`, R.lvlConf, `notated ${R.notated} x ${R.factor}: ${R.metricWhy}`);
  decide(1, "meter", R.abc + (R.meter ? ` ("${R.meter}")` : R.meterSayable ? " (four)" : " (NOT SAYABLE — counted in four)"),
         R.meterSayable ? 1 : 0.2, `${R.N} steps to the bar`);
  const alph = alphabetOf(R);
  decide(1, "key", `${PCN[alph.tonic]} ${R.det.mode}`, R.keyConf, `${alph.from}, margin ${R.det.margin}`);
  decide(1, "alphabet", `${alph.table}.${alph.name}` + (alph.modeName !== alph.name ? ` / MODES.${alph.modeName}` : ""), alph.conf,
         `says ${(alph.cov * 100).toFixed(0)}% of the weight; runners-up ${alph.runners.join(", ")}`);
  decide(1, "swing", String(R.feat.swing), R.feat.swing > 0 ? 0.6 : 1,
         "state.swing equivalent (median off-beat displacement / 0.16)");

  // 2 · ARRANGE
  const A = arrange(R);
  decide(2, "similarity", `T=${A.Tsim}`, 1, `this file's own 75th percentile of ${A.nBars} bars`);
  decide(2, "form", A.sections.map((s) => `${s.role}:${s.bars}`).join(" "), A.conf,
         `${A.clusters} distinct bar-shapes, within/between gap ${A.gap.toFixed(3)}` +
         (A.folded ? `, ${A.folded} short block${A.folded === 1 ? "" : "s"} folded to reach the box's own 12-section ceiling` : "") +
         ` — THE NAMES ARE GUESSES`);

  // 3 · MOTIFS
  const parts = partsOf(R.parsed);
  const mel = melodyLine(R.parsed, parts);
  decide(3, "melody line", parts.length ? `ch ${mel.part ? mel.part.ch : "?"} of ${parts.length} parts` : "skyline",
         mel.conf, mel.why + " — A GUESS");
  const M = motifs(R, A, mel, alph);
  if (!M.motifs.length)
    throw new Error(`${key}: no melodic window survived — ${M.windows} windows from ` +
      `${mel.notes.length} notes. A record with no motif is not a row, so nothing is written. ` +
      `(This is the refusal, not a crash: the file is either too sparse or too free ` +
      `to slice into repeating phrases.)`);
  decide(3, "motifs", `${M.motifs.length} kept`, M.motifs.length ? clamp(M.motifs.length / 3, 0, 1) : 0,
         `${M.windows} windows -> ${M.distinctShapes} distinct SHAPES (onsets + contour), ` +
         `top seen ${M.motifs.length ? M.motifs[0].seen : 0}x`);
  for (const m of M.motifs)
    say(`              ${m.name.padEnd(10)} ${String(m.notes) + " notes"} seen ${m.seen}x` +
        (m.chrom ? `, ${m.chrom} chromatic (kept as \`alt\`)` : ""));
  const kit = kitOf(R);
  decide(3, "kit", kit.kit ? Object.keys(kit.kit).sort().join("") : "none", kit.conf, kit.why);
  const bass = bassOf(R);
  decide(3, "bass", bass.style || "none", bass.conf, bass.why);

  // 4 · CHANGES
  const ch = changes(R, alph, A);
  decide(4, "roots", ch.roots ? ch.roots.join(" ") : "none", ch.conf, ch.why);
  decide(4, "prog", ch.prog ? `${ch.prog.length} chords, ${(ch.sev * 100) | 0}% sevenths` : "none (roots only)",
         ch.conf, "DEGREES, never chord names — the PROGS law");

  // 5 · THE FIGURE, THE PROVENANCE, THE ROW
  const fig = figureOf(R, mel);
  decide(5, "dyn figure", fig.name, fig.conf, fig.why);
  if (fig.table.length)
    say(`              of nine: ${fig.table.slice(0, 4).map((x) => x.k + " " + x.mse.toFixed(3)).join("  ")}` +
        `   (\`flat\` scores exactly 1.000 by construction — it predicts nothing, so a` +
        ` figure has to BEAT the null to be written)`);
  const groove = Groove.accentProfile(mel.notes, { slots: R.N, beatsPerBar: R.barLen });
  decide(5, "velocity lean", `down ${((groove.prof[0] + groove.prof[R.N / 4 | 0]) / 2).toFixed(2)}`,
         groove.notes ? 1 : 0, `mine-groove's own profile over ${groove.notes} notes`);

  const draft = makeRow(R, A, M, kit, bass, alph, ch, fig, mel, parts, O,
                        { near: [], residue: 0, r2: 0, parents: null });
  const vec = Gen.featuresOfRow(resolveRow(draft), draft.bpm);
  /* NO PARENT IS LATER THAN ITS CHILD — genres-build G2's own law, and the
     first draft broke it the moment `--label "Sedalia 1899"` was tried: the
     nearest rows in feature space were `garage`, `jamband` and `house`, none of
     which existed in 1899. So where a human HAS supplied a year, the candidate
     pool is cut to the rows that were not later than it, and the nearest is
     re-asked inside that pool. Where no year is supplied nothing is filtered,
     because nothing is being claimed: the neighbours are printed as a
     measurement of where in the table this record lands, not as ancestry. */
  const childYear = O.parents ? +(/(\d{3,4})\s*$/.exec(O.label) || [])[1] : null;
  const yearOf = (k) => { const m = /(\d{3,4})\s*$/.exec((NG.GENRES[k] || {}).label || ""); return m ? +m[1] : null; };
  const allNear = Gen.nearest(vec, 400);
  const near = (childYear
    ? allNear.filter((x) => { const y = yearOf(x.key); return y != null && y <= childYear; })
    : allNear).slice(0, 5);
  if (childYear && !near.length)
    throw new Error(`${key}: --label says ${childYear} and the catalogue holds no row that old, ` +
      `so no parent can be declared without breaking "no parent is later than its child".`);
  const fitKeys = near.slice(0, 3).map((x) => x.key);
  const fit = Gen.fitVec(vec, fitKeys);
  const residue = clamp(1 - fit.r2, 0, 1);
  let parents = null;
  if (O.parents) {
    parents = {};
    let tot = 0;
    fitKeys.forEach((k, i) => {
      const w = Math.round(fit.fitted[i] * fit.r2 * 20) / 20;      // the 0.05 grid
      if (w > 0 && tot + w <= 1) { parents[k] = w; tot += w; }
    });
    if (!Object.keys(parents).length) parents = { [fitKeys[0]]: 0.05 };
  }
  const prov = { near, residue, r2: fit.r2, parents };
  decide(6, "nearest", near.map((x) => x.key).join(" "), 1,
         near.map((x) => x.d.toFixed(3)).join(" ") + " (euclidean, genealogy's 27 features)" +
         (childYear ? `, among the ${allNear.filter((x) => { const y = yearOf(x.key); return y != null && y <= childYear; }).length} rows not later than ${childYear}` : ""));
  decide(6, "residue", `${(residue * 100).toFixed(0)}%`, 1,
         `NNLS over ${fitKeys.join("+")}, r2 ${fit.r2.toFixed(3)} — the invention`);
  decide(6, "parents", parents ? Object.entries(parents).map(([k, w]) => k + " " + w).join(" ") : "NONE (declared)",
         1, parents ? "a human supplied a Place Year label" :
            "no place, no year, therefore no parents — genres-build G2's own law");

  const row = makeRow(R, A, M, kit, bass, alph, ch, fig, mel, parts, O, prov);

  // the row must be a row the builder would accept, before anything is written
  for (const f of ["entry", "reg", "realize", "word"]) validate(row[f], key + "." + f);
  if (!Object.prototype.hasOwnProperty.call(FIGURES, row.dyn))
    throw new Error(key + ".dyn names no figure: " + row.dyn);
  if (row.note.includes("*/")) throw new Error(key + ".note carries a */ and would not survive the trip out");
  if (row.prog && row.roots) for (let i = 0; i < row.prog.length; i++)
    if (row.prog[i].d !== row.roots[i])
      throw new Error(key + ": prog and roots disagree at bar " + i + " — the PROGS law");
  rowTxt(key, row);                       // it emits, or it throws here rather than in a build
  decide("row", "schema", "valid", 1, "grammar + FIGURES + the PROGS law + the emitter, all before writing");

  const doc = sessionOf(key, row, R, A, M, kit, O.seed);
  const store = storeOf(key, row, doc, O.seed);
  const nCells = Object.keys(doc.material.cells).length;
  decide("doc", "session", `${doc.form.sections.length} sections, ${nCells} cells, ${doc.voices.length} chairs`,
         1, `seed ${O.seed}; the ROW is seed-independent (it is a measurement), the SESSION is not`);

  if (O.dry) { say("  --dry: nothing written."); return { key, row, doc, store, R, A, M, prov, fig }; }

  fs.mkdirSync(O.out, { recursive: true });
  const rowPath = path.join(O.out, key + ".json");
  const sesPath = path.join(O.out, key + ".session.json");
  fs.writeFileSync(rowPath, JSON.stringify(row, null, 2) + "\n");
  fs.writeFileSync(sesPath, JSON.stringify(store, null, 1) + "\n");
  say(`  wrote ${path.relative(ROOT, rowPath)}`);
  say(`  wrote ${path.relative(ROOT, sesPath)}`);
  if (O.json) { fs.writeFileSync(O.json, JSON.stringify({ key, row, prov, log: LOG }, null, 1) + "\n"); say("  wrote " + O.json); }

  if (O.install) {
    const dst = path.join(ROOT, "nukernel/genres", key + ".json");
    const ordP = path.join(ROOT, "nukernel/genres/_order.json");
    const ord = JSON.parse(fs.readFileSync(ordP, "utf8"));
    fs.writeFileSync(dst, JSON.stringify(row, null, 2) + "\n");
    if (!ord.includes(key)) { ord.push(key); fs.writeFileSync(ordP, JSON.stringify(ord, null, 1) + "\n"); }
    require("child_process").execFileSync(process.execPath,
      [path.join(ROOT, "tools/genres/build.js")], { stdio: "inherit" });
    say(`  installed ${key} into the catalogue and rebuilt nukernel/genres.js.`);
    say(`  ONE MOTION IS LEFT AND IT IS A HUMAN'S: nukernel/atlas.js WHEN/EXCLUDE must`);
    say(`  name this key (atlas.gate.js G1: every genre in exactly one), and G1b's own`);
    say(`  sentence about what EXCLUDE holds has to be re-argued rather than re-counted.`);
    say(`  This tool will not write that file, because where a record belongs on a map`);
    say(`  is a claim a person makes.`);
  }
  return { key, row, doc, store, R, A, M, prov, fig };
}

module.exports = { read, arrange, motifs, kitOf, bassOf, changes, alphabetOf,
                   figureOf, partsOf, melodyLine, makeRow, sessionOf, storeOf,
                   resolveRow, shapeOf, cellOf, run, barVec, cos };

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error("remix: " + e.message); process.exit(2); }
}
