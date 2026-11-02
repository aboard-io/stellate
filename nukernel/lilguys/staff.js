// THE PLAY-ALONG STAFF — one member's part as it is actually played, ENGRAVED
// BY THE ENGRAVER THE BAND SCORE USES: ui/abc.js `toScore` writes it, the
// vendored abcjs draws it, ui/paper.js reads the geometry back. Nothing here
// knows how a note is spelled, beamed, tied or stemmed; this file only folds
// the part into the phrase shape toScore reads (ui/eight.js `recordParts` /
// `scoreParts`, the same fold), and moves the finished picture.
//
// IT MOVES THE WAY THE BAND SCORE MOVES (Paul, 2026-08-26: "scroll at a steady
// speed BUT highlight notes in red. Get rid of the playhead"). The whole song
// is ONE engraving; it slides at one speed per SECTION — printed music is not
// spaced in proportion to time, so one speed for the record would let the
// sounding note wander off the screen, and one per section keeps it within a
// note's width (eight.js `pinSpeed` has the measurement) — and what says
// "here" is the sounding notehead, painted red, not a line.
//
// What is the reader's and not the score's: where on the screen "now" sits
// (`head`, a fraction of the width), how many bars fit past it (`ahead`, which
// sets the width abcjs is asked to engrave at), note names beside the heads,
// and chord symbols over the bars (eight.js `inkChords`, the same ink).
//
//   const s = new Staff(div);
//   s.set({ notes:[{beat,dur,midi}], bars:[{beat,beats,si,label,chord}],
//           key, mode, meter, clef: "treble"|"bass"|"grand"|"drums" });
//   s.options({ head, ahead, names, chords, waiting });
//   s.draw(nowBeat)          // every animation frame: a transform and a few fills
import { toScore, ottavaFor, noteNameOf } from "../ui/abc.js";
import { SCOREHEAD, inkChords, paperGeom, indexVoices, loadStaffLib, paperXAt } from "../ui/paper.js";

const K = window.NuKernel;
const SCORE_BAR_PX = 220, SCORE_ONSET_PX = 22;        // ui/eight.js: the width a bar READS at
const RED = "#d0302a";
// a General MIDI drum (what the score hands back) -> the lane letter SCOREHEAD is keyed on
const LANE_OF_GM = { 35: "k", 36: "k", 38: "s", 40: "s", 37: "p", 39: "c", 42: "h", 46: "o", 44: "f",
  51: "r", 59: "r", 53: "r", 49: "x", 57: "x", 55: "x", 52: "x", 50: "t", 48: "t", 47: "m", 45: "m", 43: "l", 41: "l" };

export class Staff {
  constructor(host) {
    this.host = host;
    host.classList.add("staff");
    this.paper = document.createElement("div"); this.paper.className = "paper";
    this.gutter = document.createElement("div"); this.gutter.className = "gutter";
    this.wait = document.createElement("p"); this.wait.className = "wait"; this.wait.hidden = true;
    host.replaceChildren(this.paper, this.gutter, this.wait);
    this.opts = { head: 0.4, ahead: null, names: false, chords: true, waiting: "" };
    this.notes = []; this.bars = []; this.data = null;
    this.ready = false; this.token = 0; this.lit = []; this.size = "";
    this.engraves = 0;
    this.marks = new Map();        // step -> "hit" | "miss": what you played, kept across engravings
  }

  // what you played, on the notes themselves: green for a note you hit,
  // orange for one that went by unplayed (red stays "sounding")
  mark(beat, kind) {
    const step = Math.round(beat * 4);
    this.marks.set(step, kind);
    if (this.ready) this.paintMark(step, kind);
  }
  clearMarks() {
    this.marks.clear();
    if (this.svg) this.svg.querySelectorAll(".lil-hit, .lil-miss").forEach((e) => e.classList.remove("lil-hit", "lil-miss"));
  }
  paintMark(step, kind) {
    this.voices.forEach((v, vi) => {
      const n = step < v.byStep.length ? v.byStep[step] : -1;
      if (n < 0 || v.notes[n].at !== step) return;
      for (const g of v.byNote[n] || []) {
        const el = this.els[vi][g];
        if (el) { el.classList.remove("lil-hit", "lil-miss"); el.classList.add(kind === "hit" ? "lil-hit" : "lil-miss"); }
      }
    });
  }

  options(o) {
    const again = ["ahead", "names", "chords", "head"].some((k) => k in o && o[k] !== this.opts[k]);
    Object.assign(this.opts, o);
    if ("waiting" in o) { this.wait.textContent = o.waiting || ""; this.wait.hidden = !o.waiting; }
    if (again && this.data) this.engrave();
  }

  set(d) {
    // a pitch doubled on one instant (two voices of one member) is one head
    const seen = new Set();
    this.notes = d.notes.slice().sort((a, b) => a.beat - b.beat).filter((n) => {
      const k = n.midi + "@" + Math.round(n.beat * 4);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    this.bars = d.bars;
    this.data = d;
    this.engrave();
  }

  /* ---- the fold: the part into toScore's phrase (eight.js scoreParts) ---- */
  build() {
    const d = this.data, bars = this.bars;
    if (!bars.length) return null;
    const last = bars[bars.length - 1];
    const T = Math.max(1, Math.round((last.beat + last.beats) * 4));      // sixteenth steps, the timeline's
    const spb = Math.max(1, Math.round(bars[0].beats * 4));
    const drums = d.clef === "drums";
    const mk = () => ({ deg: new Array(T).fill(0), oct: new Array(T).fill(0), vel: new Array(T).fill(0),
      gate: new Array(T).fill(0), midi: new Array(T).fill(null), hold: new Array(T).fill(0) });
    const split = d.clef === "grand";
    const parts = split ? [{ name: "", clef: "", phrase: mk() }, { name: "", clef: "bass", phrase: mk() }]
                        : [{ name: "", clef: drums ? "perc" : d.clef === "bass" ? "bass" : "", phrase: mk() }];
    for (const n of this.notes) {
      const i = Math.round(n.beat * 4);
      if (i < 0 || i >= T) continue;
      const p = parts[split && n.midi < 60 ? 1 : 0].phrase;
      const head = drums ? SCOREHEAD[LANE_OF_GM[n.midi] || "s"] : n.midi;
      if (head == null) continue;
      const cur = p.midi[i];
      if (cur == null) p.midi[i] = head;
      else { const a = Array.isArray(cur) ? cur : [cur]; if (!a.includes(head)) a.push(head); p.midi[i] = a; }
      p.gate[i] = 1;
      p.hold[i] = Math.max(p.hold[i], Math.max(1, Math.round(n.dur * 4)));
    }
    // ONE OCTAVE DECISION PER STAFF, off every pitch it plays (eight.js pinOttava)
    for (const p of parts) {
      const ms = [];
      for (const m of p.phrase.midi) {
        if (typeof m === "number") ms.push(m);
        else if (Array.isArray(m)) for (const x of m) if (typeof x === "number") ms.push(x);
      }
      p.ott = ottavaFor(ms, p.clef);
    }
    // a section ends on a thin double bar: the one mark a long line needs
    const divide = new Set();
    for (let b = 0; b + 1 < bars.length; b++) if (bars[b + 1].si !== bars[b].si) divide.add(b);
    const m0 = d.meter ? K.metOf({ meter: d.meter }) : null;
    const met = m0 && m0 !== K.MET4 ? m0 : null;
    const sc = toScore(parts, { key: d.key | 0, mode: d.mode, stepsPerBar: spb,
      ...(met ? { abc: met.abc, beam: met.beam } : {}), divide, close: "|]" });
    let abc = sc.abc;
    // THE INK (eight.js inkChords): chord symbols, and the section's name over its first bar
    if (this.opts.chords && !drums) abc = inkChords(abc, bars.map((b) => b.chord || null), bars.length);
    abc = inkChords(abc, bars.map((b) => (b.label ? "^" + b.label : null)), bars.length);
    const secAt = [];
    bars.forEach((b, i) => { if (i === 0 || b.si !== bars[i - 1].si) secAt.push(Math.round(b.beat * 4)); });
    return { abc, voices: sc.voices, dense: sc.dense | 0, T, secAt };
  }

  /* ---- the engraving: one picture, sized to the room ---- */
  engrave() {
    let built;
    try { built = this.build(); } catch (e) { console.warn("lilguys staff: toScore failed", e); return; }
    if (!built) return;
    const my = ++this.token;
    this.ready = false;
    const r = this.host.getBoundingClientRect();
    this.size = Math.round(r.width) + "x" + Math.round(r.height);
    return loadStaffLib().then((A) => {
      if (!A || my !== this.token) return;
      // THE WIDTH: a reader's look-ahead asks for that many bars across what is
      // left of the screen past "now"; otherwise the band score's own rule, a
      // width per bar that grows with how busy the busiest bar is.
      const nb = this.bars.length;
      const dense = Math.max(SCORE_BAR_PX, built.dense * SCORE_ONSET_PX);
      const render = (perBar) => {
        this.paper.replaceChildren();
        const t0 = performance.now();
        const tune = A.renderAbc(this.paper, built.abc, { add_classes: true, staffwidth: Math.round(nb * perBar),
          paddingleft: 4, paddingright: 4, paddingtop: 2, paddingbottom: 2 })[0];
        this.ms = performance.now() - t0;
        return tune;
      };
      let tune = render(dense);
      let svg = this.paper.querySelector("svg"), geom = paperGeom(tune);
      if (!svg || !geom) return;
      const fit = (el) => {
        const h = +el.getAttribute("height") || 100;
        // as big as the room allows, up to the size a staff is read at from a
        // music stand (past ~1.7 the pinned clef alone eats a phone's width)
        return Math.max(0.5, Math.min(1.7, (Math.max(60, r.height) - 4) / h));
      };
      let s = fit(svg);
      if (this.opts.ahead && r.width > 0) {
        const gw = (geom.x0 - 2) * s, head = Math.max(r.width * this.opts.head, gw + 0.3 * (r.width - gw));
        const want = (r.width - head - 8) / this.opts.ahead / s;   // svg units a bar
        // never tighter than the notes can stand: past that, fewer bars show than asked
        const per = Math.max(want, built.dense * 14, 60);
        if (Math.abs(per - dense) / dense > 0.05) {
          tune = render(per); svg = this.paper.querySelector("svg"); geom = paperGeom(tune);
          if (!svg || !geom) return;
          s = fit(svg);
        }
      }
      this.engraves++;
      this.s = s; this.geom = geom; this.svg = svg; this.T = built.T; this.secAt = built.secAt;
      this.voices = indexVoices(built.voices, built.T);
      this.els = this.voices.map((v, i) => [...svg.querySelectorAll(".abcjs-note.abcjs-v" + i)]);
      this.drawnNotes = this.voices.reduce((a, v) => a + v.notes.length, 0);
      // abcjs sizes and CLIPS the element it draws into (overflow hidden, its
      // own height): the scale and the motion go on that element, so the
      // picture is never cut by a box drawn at the old size
      this.paper.style.overflow = "visible";
      this.paper.style.transformOrigin = "0 0";
      this.top = Math.max(0, (r.height - (+svg.getAttribute("height") || 0) * s) / 2);
      if (this.opts.names && this.data.clef !== "drums") this.nameHeads();
      this.speeds();
      this.gutterFrom();
      // the moving picture keeps its music and lets its margin go: the pinned
      // copy is the clef a reader sees, and two of them side by side at the
      // top of the song read as a mistake
      svg.querySelectorAll(".abcjs-staff-extra, .abcjs-bracket").forEach((e) => { e.style.visibility = "hidden"; });
      this.lit = [];
      this.ready = true;
      for (const [step, kind] of this.marks) this.paintMark(step, kind);
    }).catch((e) => console.warn("lilguys staff: engraving failed", e));
  }

  // THE STEADY SPEED, PER SECTION (eight.js pinSpeed): each section's paper
  // divided by its time, so a boundary is a change of pace and never a jump
  speeds() {
    const g = this.geom, endT = this.T / 16, S = this.secAt;
    this.secX = []; this.secV = [];
    for (let i = 0; i < S.length; i++) {
      const s0 = S[i], s1 = i + 1 < S.length ? S[i + 1] : this.T;
      this.secX[i] = paperXAt(g, s0 / 16, endT);
      this.secV[i] = (paperXAt(g, s1 / 16, endT) - this.secX[i]) / Math.max(1, s1 - s0);
    }
  }
  paperAt(step) {
    const S = this.secAt;
    let i = 0;
    while (i + 1 < S.length && S[i + 1] <= step) i++;
    return this.secX[i] + (step - S[i]) * this.secV[i];
  }

  // the clef and key, pinned at the left while the music slides behind them
  // (eight.js gutterFrom: a clone of the engraving's own margin, not a render)
  gutterFrom() {
    const w = Math.max(0, (this.geom.x0 - 2) * this.s);
    const clone = this.svg.cloneNode(true);
    clone.style.transform = `translateY(${this.top.toFixed(1)}px) scale(${this.s})`;
    clone.querySelectorAll(".abcjs-note, .abcjs-rest, .abcjs-chord, .abcjs-annotation, .lil-name, .abcjs-bar, .abcjs-beam-elem, .abcjs-ledger")
      .forEach((e) => e.remove());
    this.gutter.replaceChildren(clone);
    this.gutter.style.width = w + "px";
    this.gutterW = w;
  }

  // training wheels: each head's name beside it, in the key's own spelling
  nameHeads() {
    const NS = "http://www.w3.org/2000/svg", d = this.data;
    this.voices.forEach((v, vi) => {
      v.notes.forEach((nt, ni) => {
        const g = (v.byNote[ni] || [])[0], el = this.els[vi][g];
        if (el == null || nt.midi == null) return;
        const ms = (Array.isArray(nt.midi) ? nt.midi : [nt.midi]).filter((m) => typeof m === "number");
        if (!ms.length) return;
        const b = el.getBBox();
        const t = document.createElementNS(NS, "text");
        t.setAttribute("class", "lil-name");
        t.setAttribute("x", b.x);
        t.setAttribute("y", b.y + b.height + 9);   // under the glyph: clear of dots, flags and accidentals
        t.textContent = ms.map((m) => noteNameOf(m, d.key | 0, d.mode)).join("·");
        this.svg.appendChild(t);
      });
    });
  }

  draw(now) {
    if (!this.ready) return;
    const r = this.host.getBoundingClientRect();
    const size = Math.round(r.width) + "x" + Math.round(r.height);
    if (size !== this.size && r.width > 0) {   // turned round, or the room changed: engrave for the new room
      this.size = size; clearTimeout(this.re); this.re = setTimeout(() => this.engrave(), 120);
    }
    const step = now * 4;                     // (before the song — a count-in — is to the left of bar 1)
    // "NOW" IS NEVER UNDER THE PINNED CLEF: the red note has to be seen
    // and a held note's head stays in sight while it rings: clear of the margin by three tenths of what is left, and near the middle (Paul, 2026-11-02: "it keeps hiding behind the clef")
    const headX = Math.max(r.width * this.opts.head, (this.gutterW || 0) + 0.3 * (r.width - (this.gutterW || 0)));
    this.headX = headX;
    const x = this.paperAt(step) * this.s;
    this.paper.style.transform = `translate(${(headX - x).toFixed(1)}px, ${this.top.toFixed(1)}px) scale(${this.s})`;
    // THE RED NOTE IS "HERE" (eight.js lightScore)
    for (const e of this.lit) e.style.fill = "";
    this.lit = [];
    if (now < 0) return;
    const s = Math.floor(Math.max(0, step));
    this.voices.forEach((v, vi) => {
      const n = s < v.byStep.length ? v.byStep[s] : -1;
      if (n < 0) return;
      for (const g of v.byNote[n] || []) { const el = this.els[vi][g]; if (el) { el.style.fill = RED; this.lit.push(el); } }
    });
  }
}
