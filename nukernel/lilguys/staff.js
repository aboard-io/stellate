// THE SCROLLING STAFF — one member's part as it is actually played, on a staff
// that slides right to left under a fixed playhead, so you can read along and
// play it on your own instrument while the band plays without that member.
//
// Spacing is proportional to time (a beat is always the same width), so the
// note under the line is the note sounding, at any tempo. The notation is real
// where it helps a reader — clef, key signature, ledger lines, accidentals by
// the key, open heads for halves and wholes, stems and flags — and a pale bar
// after each head draws exactly how long it is held.
//
//   const s = new Staff(canvas);
//   s.set({ notes:[{beat,dur,midi}], bars:[{beat,beats,label,chord}],
//           tonicPc, flats, color, clef: "treble"|"bass"|"grand"|"drums" });
//   s.draw(nowBeat)   // every animation frame

const PX_PER_BEAT = 64;
const SHARP_ORDER = [5, 0, 7, 2, 9, 4, 11]; // F C G D A E B
const FLAT_ORDER = [11, 4, 9, 2, 7, 0, 5];  // B E A D G C F
// a key's accidentals by tonic pitch class (major): positive sharps, negative flats
const KEY_SIG_MAJOR = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // pitch class -> letter index (C=0) under sharps
const LETTER_FLAT = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const NAT = [0, 2, 4, 5, 7, 9, 11];

// a key signature count for a tonic and a scale's third/sixth (minor modes → relative major)
export function keySig(tonicPc, modeOffsetToMajor = 0) {
  return KEY_SIG_MAJOR[((tonicPc + modeOffsetToMajor) % 12 + 12) % 12];
}

export class Staff {
  constructor(canvas) {
    this.cv = canvas;
    this.cx = canvas.getContext("2d");
    this.notes = []; this.bars = []; this.sig = 0; this.color = "#ffd24a"; this.clef = "treble";
    this.drumLanes = null;
  }

  set({ notes, bars, sig = 0, color, clef = "treble", drumLanes = null, lead = 1.5 }) {
    // a pitch doubled on one instant (two voices of one member) is one head
    const seen = new Set();
    this.notes = notes.slice().sort((a, b) => a.beat - b.beat).filter((n) => {
      const k = n.midi + "@" + Math.round(n.beat * 48);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    this.bars = bars; this.sig = sig; this.color = color || this.color;
    this.clef = clef; this.drumLanes = drumLanes; this.lead = lead;
    // spelling: sharps in sharp keys, flats in flat keys
    const acc = new Map();
    const order = sig >= 0 ? SHARP_ORDER : FLAT_ORDER;
    for (let i = 0; i < Math.abs(sig); i++) acc.set(order[i], sig >= 0 ? 1 : -1);
    this.keyAcc = acc;
  }

  // a midi note as (diatonic step from C4, accidental shown: -1 flat, 0 none, 1 sharp, 2 natural)
  spell(midi) {
    const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12) - 5; // C4 = 60 -> oct 0
    const flats = this.sig < 0;
    const li = flats ? LETTER_FLAT[pc] : LETTER[pc];
    const natPc = NAT[li];
    const alt = ((pc - natPc + 18) % 12) - 6; // -1, 0, 1
    const keyAlt = this.keyAcc.get(natPc) || 0;
    let shown = 0;
    if (alt !== keyAlt) shown = alt === 0 ? 2 : alt;
    return { step: oct * 7 + li, shown };
  }

  resize() {
    const r = this.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.cx.setTransform(d, 0, 0, d, 0, 0);
    this.W = r.width; this.H = r.height;
  }

  draw(now) {
    this.resize();
    const c = this.cx, W = this.W, H = this.H;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "#fbf8f0"; c.fillRect(0, 0, W, H);
    const headX = Math.round(W * 0.28);
    const x = b => headX + (b - now) * PX_PER_BEAT;
    const gap = Math.max(7, Math.min(10, H / 22)); // staff line spacing
    const grand = this.clef === "grand";
    const drums = this.clef === "drums";
    // the staves: top line y for each; a step is half a gap
    const staves = grand
      ? [{ clef: "treble", top: H * 0.5 - gap * 6.5 }, { clef: "bass", top: H * 0.5 + gap * 2.5 }]
      : [{ clef: drums ? "drums" : this.clef, top: H * 0.5 - gap * 2 }];
    // the step (diatonic from C4) of each staff's top line: treble F5 = 10, bass A3 = -2
    staves.forEach(s => { s.topStep = s.clef === "bass" ? -2 : 10; });
    const yOf = (st, step) => st.top + (st.topStep - step) * gap / 2;
    const ink = "#2a2630", faint = "#b9b2a4";

    // bars: lines, numbers, section names, chords
    const vis0 = now - headX / PX_PER_BEAT - 1, vis1 = now + (W - headX) / PX_PER_BEAT + 1;
    c.font = "600 11px system-ui, sans-serif";
    for (const b of this.bars) {
      if (b.beat + b.beats < vis0 || b.beat > vis1) continue;
      const bx = x(b.beat);
      c.fillStyle = faint;
      for (let k = 1; k < b.beats; k++) c.fillRect(Math.round(x(b.beat + k)), staves[0].top - gap * 3, 1, 2);
      c.fillStyle = ink;
      const yTop = staves[0].top, yBot = staves[staves.length - 1].top + gap * 4;
      c.fillRect(Math.round(bx), yTop, 1.2, yBot - yTop);
      if (b.label) {
        c.fillStyle = "#7a2e8a"; c.font = "700 12px system-ui, sans-serif";
        c.fillText(b.label, bx + 4, 14);
        c.font = "600 11px system-ui, sans-serif";
      }
      c.fillStyle = "#8a8070"; c.fillText(String(b.n), bx + 3, yTop - gap * 3.4);
      if (b.chord && !drums) { c.fillStyle = "#1f5f8a"; c.font = "600 13px system-ui, sans-serif"; c.fillText(b.chord, bx + 4, yTop - gap * 1.4); c.font = "600 11px system-ui, sans-serif"; }
      if (b.chord2 && !drums) { c.fillStyle = "#1f5f8a"; c.font = "600 13px system-ui, sans-serif"; c.fillText(b.chord2, x(b.beat + b.beats / 2) + 4, yTop - gap * 1.4); c.font = "600 11px system-ui, sans-serif"; }
    }

    // staff lines
    c.fillStyle = ink;
    for (const s of staves) {
      if (s.clef === "drums") {
        for (let i = 0; i < 5; i++) c.fillRect(0, Math.round(s.top + i * gap), W, 1);
      } else for (let i = 0; i < 5; i++) c.fillRect(0, Math.round(s.top + i * gap), W, 1);
    }

    // notes (a chord: heads each, one stem)
    const groups = new Map();
    for (const n of this.notes) {
      if (n.beat + n.dur < vis0 || n.beat > vis1) continue;
      const nx = x(n.beat), w = Math.max(3, n.dur * PX_PER_BEAT - 3);
      const past = n.beat + n.dur < now, sounding = n.beat <= now && now < n.beat + n.dur;
      const col = sounding ? this.color : past ? "#a8a196" : ink;
      if (drums) {
        const lane = this.drumLanes ? this.drumLanes(n) : { pos: 4, x: false };
        const st = staves[0], y = st.top + lane.pos * gap / 2;
        c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.4;
        if (lane.x) {
          c.beginPath();
          c.moveTo(nx - 4, y - 4); c.lineTo(nx + 4, y + 4); c.moveTo(nx + 4, y - 4); c.lineTo(nx - 4, y + 4); c.stroke();
        } else { c.beginPath(); c.ellipse(nx, y, 5, 3.8, -0.35, 0, Math.PI * 2); c.fill(); }
        c.fillRect(nx + 4, y - gap * 3, 1.2, gap * 3);
        if (sounding) { c.globalAlpha = 0.25; c.fillRect(nx - 7, st.top - gap, 14, gap * 6); c.globalAlpha = 1; }
        continue;
      }
      const st = grand ? (n.midi >= 60 ? staves[0] : staves[1]) : staves[0];
      const sp = this.spell(n.midi);
      const y = yOf(st, sp.step);
      // the hold
      c.fillStyle = sounding ? this.color : past ? "#e6e0d4" : "#e9dfc6";
      c.globalAlpha = sounding ? 0.55 : 1;
      c.fillRect(nx + 4, y - 2.5, w - 4, 5);
      c.globalAlpha = 1;
      // ledger lines
      c.fillStyle = col;
      const lineSteps = [];
      const top = st.topStep, bot = st.topStep - 8;
      for (let s = top + 2; s <= sp.step; s += 2) lineSteps.push(s);
      for (let s = bot - 2; s >= sp.step; s -= 2) lineSteps.push(s);
      for (const s of lineSteps) c.fillRect(nx - 8, Math.round(yOf(st, s)), 16, 1.2);
      // head
      const open = n.dur >= 1.99;
      c.beginPath(); c.ellipse(nx, y, 5.4, 3.9, -0.35, 0, Math.PI * 2);
      if (open) { c.strokeStyle = col; c.lineWidth = 1.6; c.stroke(); } else c.fill();
      // the stem is the chord's, drawn once below: gather it
      const gk = (st === staves[0] ? 0 : 1) + ":" + Math.round(n.beat * 48);
      let g = groups.get(gk);
      if (!g) groups.set(gk, g = { nx, st, lo: sp.step, hi: sp.step, dur: n.dur, col });
      g.lo = Math.min(g.lo, sp.step); g.hi = Math.max(g.hi, sp.step); g.dur = Math.min(g.dur, n.dur);
      if (sounding) g.col = col;
      // accidental
      if (sp.shown) {
        c.font = "16px serif"; c.fillStyle = col;
        c.fillText(sp.shown === 1 ? "♯" : sp.shown === -1 ? "♭" : "♮", nx - 17, y + 5);
      }
      if (sounding) { c.globalAlpha = 0.3; c.beginPath(); c.arc(nx, y, 10, 0, Math.PI * 2); c.fillStyle = this.color; c.fill(); c.globalAlpha = 1; }
    }

    for (const g of groups.values()) {
      if (g.dur >= 3.99) continue;                       // a whole note: no stem
      const up = (g.lo + g.hi) / 2 < g.st.topStep - 4;
      const yLo = yOf(g.st, g.lo), yHi = yOf(g.st, g.hi);
      const sx = up ? g.nx + 4.6 : g.nx - 4.6;
      const sy = up ? yHi - gap * 3.3 : yLo + gap * 3.3;
      const y0 = up ? yLo : yHi;
      c.fillStyle = g.col;
      c.fillRect(sx - 0.6, Math.min(y0, sy), 1.3, Math.abs(sy - y0));
      const flags = g.dur < 0.374 ? 2 : g.dur < 0.74 ? 1 : 0;
      c.strokeStyle = g.col; c.lineWidth = 1.8;
      for (let f = 0; f < flags; f++) {
        const fy = sy + (up ? f * 5 : -f * 5);
        c.beginPath(); c.moveTo(sx, fy); c.quadraticCurveTo(sx + 7, fy + (up ? 5 : -5), sx + 6, fy + (up ? 11 : -11)); c.stroke();
      }
    }

    // the left margin: clef and key signature, over the scrolled music
    const mw = 46 + Math.abs(this.sig) * 9;
    const grd = c.createLinearGradient(mw, 0, mw + 24, 0);
    grd.addColorStop(0, "rgba(251,248,240,1)"); grd.addColorStop(1, "rgba(251,248,240,0)");
    c.fillStyle = "#fbf8f0"; c.fillRect(0, 0, mw, H);
    c.fillStyle = grd; c.fillRect(mw, 0, 24, H);
    c.fillStyle = ink;
    for (const s of staves) {
      for (let i = 0; i < 5; i++) c.fillRect(0, Math.round(s.top + i * gap), mw, 1);
      if (s.clef === "drums") {
        c.fillRect(10, s.top + gap, 3, gap * 2); c.fillRect(16, s.top + gap, 3, gap * 2);
        continue;
      }
      c.font = `${Math.round(gap * (s.clef === "treble" ? 6.4 : 4.6))}px serif`;
      c.fillText(s.clef === "treble" ? "𝄞" : "𝄢", 3, s.clef === "treble" ? s.top + gap * 4.6 : s.top + gap * 3.3);
      // key signature
      const order = this.sig >= 0 ? SHARP_ORDER : FLAT_ORDER;
      // placement steps on the treble staff (sharps F5 C5 G5 D5 A4 E5 B4; flats B4 E5 A4 D5 G4 C5 F4)
      const tS = [10, 7, 11, 8, 5, 9, 6], tF = [6, 9, 5, 8, 4, 7, 3];
      c.font = "17px serif";
      for (let i = 0; i < Math.abs(this.sig); i++) {
        let step = (this.sig >= 0 ? tS : tF)[i];
        if (s.clef === "bass") step -= 14;   // two octaves down: the bass staff's places
        c.fillText(this.sig >= 0 ? "♯" : "♭", 38 + i * 9, yOf(s, step) + 5);
      }
      void order;
    }

    // the playhead
    c.fillStyle = this.color; c.globalAlpha = 0.9;
    c.fillRect(headX - 1, 18, 2, H - 24);
    c.globalAlpha = 1;
  }
}
