// roll.js — ONE track's piano roll, on a canvas.
//
// Canvas, not SVG, for one reason: this repaints on every knob turn. A busy genre
// puts ~1,200 drum events and a few hundred pitched ones on screen at once; as SVG
// that is a few thousand nodes to build and throw away per keystroke, and the rack
// draws five of these side by side.
//
// The roll draws what the ENGINE emitted, never a re-derivation: pitch comes
// through CsdEngine.pchToMidi (the same call midi-export.js makes), amp is the
// event's own, and the section rules come from the same section math buildEvents
// walks. If the roll and the audio ever disagree, the roll is wrong by definition.
const E = window.CsdEngine;

// the drum lanes, top to bottom — the order a drummer reads, not alphabetical
const DRUM_LANES = ["crash", "ride", "hat", "snare", "clap", "rim", "tom", "perc", "kick"];
const PAD = { top: 6, bottom: 6 };

// the midi span of a pitched event list — THE GRID ranges a whole ROW with this
// and pins every cell to it via opts.range
export function midiRange(evs) {
  let lo = Infinity, hi = -Infinity;
  for (const e of evs || []) {
    const m = E.pchToMidi(e.pch);
    if (m < lo) lo = m; if (m > hi) hi = m;
  }
  if (!isFinite(lo)) return null;
  if (hi - lo < 11) { const c = (hi + lo) / 2; lo = c - 6; hi = c + 6; }
  return { lo, hi };
}

export function drawRoll(cv, evs, opts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 600, h = cv.clientHeight || 64;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  // ---- the WINDOW (THE GRID's cells): draw only [beatFrom, beatTo) ----
  // Absent, the roll draws the whole song exactly as before. Events are
  // filtered to the window (overlap counts), and x maps window-relative.
  const from = opts.beatFrom != null ? opts.beatFrom : 0;
  const to = opts.beatTo != null ? opts.beatTo : Math.max(1, opts.totalBeats);
  const span = Math.max(0.001, to - from);
  const x = (b) => ((b - from) / span) * w;
  if (evs && (opts.beatFrom != null || opts.beatTo != null))
    evs = evs.filter((e) => e.beat < to && (e.beat + (e.dur || 0.1)) > from);

  // ---- section rules first, so notes sit ON them ----
  g.strokeStyle = "rgba(255,255,255,.13)"; g.lineWidth = 1;
  for (const sp of opts.spans || []) {
    if (sp.start <= from || sp.start >= to) continue;
    const px = Math.round(x(sp.start)) + 0.5;
    g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke();
  }

  if (!evs || !evs.length) {
    g.fillStyle = "rgba(255,255,255,.28)";
    g.font = "12px ui-monospace, monospace";
    g.fillText("— silent —", 8, h / 2 + 4);
    return;
  }

  const hue = opts.hue != null ? opts.hue : 200;
  const inner = h - PAD.top - PAD.bottom;

  if (opts.kind === "drums") {
    // lane the kit; a piece with no lane of its own rides the bottom (kick) row
    // rather than vanishing — the viz law from panels/inside/timeline.js: a lane
    // that matches nothing must still be VISIBLE, or half a sampled kit goes missing.
    const lanes = DRUM_LANES.filter((d) => evs.some((e) => e.drum === d));
    const rows = Math.max(1, lanes.length);
    const rh = inner / rows;
    for (let i = 0; i < rows; i++) {          // lane guides
      const y = PAD.top + i * rh + rh / 2;
      g.strokeStyle = "rgba(255,255,255,.05)";
      g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); g.stroke();
    }
    for (const e of evs) {
      const li = lanes.indexOf(e.drum);
      const y = PAD.top + (li < 0 ? rows - 1 : li) * rh + rh / 2;
      const a = Math.max(0.12, Math.min(1, (e.amp || 0.2) * 1.7));
      g.fillStyle = `hsla(${hue},70%,${e.open ? 78 : 62}%,${a})`;
      const bw = Math.max(1.5, x(Math.max(0.05, e.dur || 0.1)) - x(0));
      g.fillRect(x(e.beat), y - Math.max(1.5, rh * 0.30), bw, Math.max(3, rh * 0.60));
    }
    return;
  }

  // ---- pitched: y = midi, auto-ranged to the notes present ----
  // opts.range {lo,hi} pins the range instead — THE GRID auto-ranges per ROW,
  // not per cell, so contours compare across sections.
  let lo = Infinity, hi = -Infinity;
  const midi = new Array(evs.length);
  for (let i = 0; i < evs.length; i++) {
    const m = E.pchToMidi(evs[i].pch);
    midi[i] = m;
    if (m < lo) lo = m; if (m > hi) hi = m;
  }
  if (opts.range && isFinite(opts.range.lo) && isFinite(opts.range.hi)) { lo = opts.range.lo; hi = opts.range.hi; }
  if (!isFinite(lo)) return;
  if (hi - lo < 11) { const c = (hi + lo) / 2; lo = c - 6; hi = c + 6; }   // never zoom a flat line to full height
  const y = (m) => PAD.top + inner - ((m - lo) / (hi - lo)) * inner;
  const nh = Math.max(2.5, Math.min(7, inner / (hi - lo + 1)));

  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    const a = Math.max(0.2, Math.min(1, (e.amp || 0.2) * 3.2));
    // a pipe-added copy (harmonize/echo/pump/ghost) is drawn dimmer and thinner:
    // it is the note-fx rack's work, not this machine's, and the rack must be able
    // to see which is which at a glance
    const derived = e.harm || e.pump || e.ghost || e.pass;
    g.fillStyle = `hsla(${hue},${derived ? 40 : 72}%,${derived ? 52 : 66}%,${derived ? a * 0.5 : a})`;
    const bw = Math.max(2, x(Math.max(0.06, e.dur || 0.25)) - x(0) - 0.5);
    g.fillRect(x(e.beat), y(midi[i]) - nh / 2, bw, derived ? Math.max(1.5, nh * 0.6) : nh);
  }
}
