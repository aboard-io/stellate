// kernel-daw.js — the UI ONLY. The algebra is kernel.js, the genre table is
// genres.js; both load before this file (see kernel-daw.html).
//
// THE SONG IS THE SURFACE. Select a box, then click things on and off in it.
// Boxes drag to REORDER, and only to reorder — nothing is dragged into them.
// Click a box to play from there; double-click to loop it alone.
const { harm, render, drums, bass, ROMAN, word, drop, envelope,
        reverse, invert, rotate } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL } = window.NuGenres;

const DEFAULT_BPM = 126, NSLOTS = 8, NBOXES = 4;
const PX_PER_BAR = 22, BAR_PX = 26, MAX_LEN = 64;

/* ---------- phrases ---------- */
const z = () => new Array(16).fill(0);
const blank = () => ({ deg: z(), oct: z(), vel: new Array(16).fill(5),
                       gate: z(), acc: z(), sld: z() });
const isBlank = p => p.gate.every(g => !g);

let SLOTS = Array.from({ length: NSLOTS }, blank);
let slot = 0;
let SUBJ = SLOTS[slot];                     // by reference: cell edits mutate the slot

function randomPhrase() {
  const r = n => Math.floor(Math.random() * n), p = blank();
  for (let i = 0; i < 16; i++) {
    p.deg[i] = r(11) - 3;
    p.oct[i] = r(8) === 0 ? -1 : r(5) === 0 ? 1 : 0;
    p.gate[i] = r(10) < 7 ? 1 : 0;
    p.acc[i] = p.gate[i] && r(10) < 3 ? 1 : 0;
    p.sld[i] = p.gate[i] && r(10) < 2 ? 1 : 0;
    p.vel[i] = p.acc[i] ? 8 + r(2) : 3 + r(5);
  }
  return p;
}

/* ---------- song ---------- */
// A BOX is a genre, a SET of phrases, transforms, a length in bars and a nudge.
// LEN and NUDGE are a window onto the genre's own form: a fugue with len 2 and
// nudge 2 plays the last two bars of its four-bar form. The genre still renders
// its whole form — the box just decides which part of it you hear.
const OPS = { rev: reverse(), inv: invert(4), drop2: drop(2), drop3: drop(3) };
const OPLABEL = { rev: "reverse", inv: "invert", drop2: "drop 2", drop3: "drop 3" };
const ENVLABEL = { in: "fade in", out: "fade out" };

const RATES = { half: 0.5, dbl: 2 };
const RATELABEL = { half: "half time", dbl: "double time" };
const emptyBox = () =>
  ({ genre: null, slots: [], len: 0, nudge: 0, ops: [], env: null, mode: null, rate: null });

// The genre a box actually renders with: its own definition, plus whatever the
// box overrides. Mode and tempo are not pattern operators and not envelopes —
// they are the third kind, a change to the GENRE the phrase is read through.
const genreOf = sec => {
  const g = GENRES[sec.genre];
  if (!sec.mode && !sec.rate) return g;
  return { ...g, ...(sec.mode ? { mode: MODES[sec.mode] } : {}),
           ...(sec.rate ? { rate: g.rate * RATES[sec.rate] } : {}) };
};
let SONG = Array.from({ length: NBOXES }, emptyBox);
let viewSec = 0, playingSec = -1, loopOnly = null, dragFrom = null;

const curSection = () => SONG[Math.min(viewSec, SONG.length - 1)];
const boxBars = b => (b.genre ? b.len : 0);

/* ---------- what a box contributes ---------- */
// MULTIPLE PHRASES combine by being dealt across the genre's own voices: voice v
// plays phrase v % n. Two phrases in a four-voice fugue is a double fugue; two
// phrases in acid is two 303s running different patterns, which is what acid
// records actually did. The voice count never changes — the phrases share it.
function sectionEvents(sec) {
  if (!sec.genre) return { g: null, bars: 0, ev: [] };
  const g = genreOf(sec);
  const len = Math.max(1, sec.len || g.bars), nudge = sec.nudge % g.bars;
  const total = Math.ceil((nudge + len) / g.bars) * g.bars;
  const barSteps = 16 / g.rate, from = nudge * barSteps, to = (nudge + len) * barSteps;

  const phrases = (sec.slots.length ? sec.slots : [null])
    .map(i => word(i == null ? blank() : SLOTS[i], sec.ops.map(o => OPS[o])));
  const nP = phrases.length, out = [];

  phrases.forEach((ph, pi) => {
    const pitched = render(ph, g, total);
    for (let v = pi; v < g.voices; v += nP) {
      let prev = null;
      for (const e of pitched.filter(e => e.v === v)) {
        out.push({ ...e, kind: "line", prev, pad: g.realize(v) === "pad" });
        prev = e.n;
      }
    }
  });

  // Drums and bass follow the FIRST phrase — the kit is genre data anyway, and
  // the bass reads accents, which only one line can own.
  const lead = phrases[0];
  const dr = drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
  for (let r = 0; r < total / g.bars; r++)
    for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
  for (const e of bass(lead, g, total)) out.push({ ...e, kind: "bass" });

  const win = out.filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  return { g, bars: len, ev: envelope(win, sec.env, len * barSteps) };
}

/* ---------- arrangement view of the selected box ---------- */
const gridEl = document.getElementById("grid");
let stepW = 7, phEls = [], viewSteps = 64;

// The playhead marks which box is SOUNDING. It must not move the SELECTION —
// the selected box is what every palette click acts on, and having playback
// steal it means a click lands on whatever bar happened to be playing.
function showSection(si) {
  if (si === playingSec) return;
  playingSec = si; drawSong();
}

function draw() {
  const sec = curSection(), { g, bars, ev } = sectionEvents(sec);
  gridEl.innerHTML = ""; phEls = [];
  writeSrc(); drawPalette();
  if (!g) {
    document.getElementById("readout").textContent =
      "box " + (viewSec + 1) + " is empty — click a genre below to fill it";
    return;
  }
  const lanes = [];
  const nP = Math.max(1, sec.slots.length);
  for (let v = 0; v < g.voices; v++)
    lanes.push({ name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: (sec.slots.length > 1 ? "phrase " + (sec.slots[v % nP] + 1) + " · " : "") + (g.words[v] || ""),
      kind: "pitch", color: "var(--v" + v + ")",
      ev: ev.filter(e => e.kind === "line" && e.v === v) });
  lanes.push({ name: "Bass", op: (g.bassStyle === "walk" ? "walking · " : "roots · ") + g.harmony,
    kind: "pitch", color: "var(--vb)", ev: ev.filter(e => e.kind === "bass") });
  const hits = ev.filter(e => e.kind === "hit");
  for (const d of [...new Set(hits.map(e => e.d))])
    lanes.push({ name: DRUMNAME[d] || d,
      op: d === "p" ? "only(acc, rotate 3)"
        : (g.fill && g.fill[d]) ? "grid + fill every " + g.bars : "grid",
      kind: "drum", color: "var(--drum)", ev: hits.filter(e => e.d === d) });

  const steps = bars * 16 / g.rate; viewSteps = steps;
  const avail = Math.max(560, document.getElementById("dawscroll").clientWidth - 118);
  stepW = Math.max(4, Math.min(22, avail / steps));
  gridEl.style.gridTemplateColumns = "118px " + steps * stepW + "px";

  gridEl.append(Object.assign(document.createElement("div"), { className: "rulerpad" }));
  const ruler = document.createElement("div"); ruler.className = "ruler";
  for (let b = 0; b < bars; b++) {
    const t = document.createElement("div"); t.className = "tick b";
    t.style.left = (b * 16 * stepW / g.rate) + "px";
    t.textContent = "bar " + (sec.nudge % g.bars + b + 1);
    ruler.append(t);
  }
  gridEl.append(ruler);

  lanes.forEach((L, li) => {
    const h = document.createElement("div"); h.className = "head";
    h.innerHTML = '<div class="nm"><span class="swatch" style="background:' + L.color +
      '"></span>' + L.name + '</div><div class="op">' + L.op + "</div>";
    gridEl.append(h);
    const lane = document.createElement("div");
    lane.className = "lane" + (li % 2 ? " alt" : "");
    lane.style.height = (L.kind === "pitch" ? 54 : 22) + "px";
    for (let b = 1; b < bars; b++) {
      const bl = document.createElement("div"); bl.className = "barline";
      bl.style.left = (b * 16 * stepW / g.rate) + "px"; lane.append(bl);
    }
    if (L.ev.length) {
      const ns = L.ev.map(e => e.n).filter(n => n != null);
      const lo = ns.length ? Math.min(...ns) : 0, hi = ns.length ? Math.max(...ns) : 1;
      const span = Math.max(1, hi - lo);
      for (const e of L.ev) {
        const d = document.createElement("div");
        d.className = "note" + (e.acc ? " acc" : "") + (e.fill ? " fill" : "");
        d.style.left = (e.t * stepW) + "px";
        d.style.background = L.color;
        d.style.opacity = String(0.18 + 0.82 * ((e.vel == null ? 5 : e.vel) / 9));
        if (L.kind === "pitch") {
          const hh = Math.max(3, Math.min(7, 54 / (span + 2)));
          d.style.width = Math.max(2, (e.dur || 1) * stepW - 1) + "px";
          d.style.height = hh + "px";
          d.style.top = (4 + (1 - (e.n - lo) / span) * (54 - 8 - hh)) + "px";
          if (e.sld) d.style.background = "linear-gradient(90deg,transparent," + L.color + ")";
        } else {
          d.style.width = Math.max(2, stepW - 1) + "px";
          d.style.height = e.acc ? "14px" : "9px";
          d.style.top = e.acc ? "4px" : "6px";
        }
        lane.append(d);
      }
    }
    const ph = document.createElement("div"); ph.className = "playhead";
    ph.style.transform = "translateX(-3px)"; lane.append(ph); phEls.push(ph);
    gridEl.append(lane);
  });

  const roots = g.harmony === "modal" ? "one mode, no motion"
    : "roots " + Array.from({ length: bars }, (_, b) =>
        ROMAN[harm(SLOTS[sec.slots[0]] || blank(), g, sec.nudge % g.bars + b)]).join(" ") +
      (g.harmony === "emergent" ? " (computed)" : "");
  document.getElementById("readout").textContent =
    "box " + (viewSec + 1) + " · " + GENRES[sec.genre].label + " · " +
    (sec.slots.length ? sec.slots.map(i => "phrase " + (i + 1)).join(" + ") : "no phrase") +
    " · " + bars + " bars" + (sec.nudge ? " nudged " + sec.nudge : "") + " · " + roots;
}

/* ---------- audio ---------- */
let ctx = null, bus = null, verb = null, verbGain = null, noise = null;
let playing = false, timer = null;
let nextBarTime = 0, nextBar = 0, passStart = 0;

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3.2; comp.knee.value = 8;
  bus = ctx.createGain(); bus.gain.value = .9;
  verb = ctx.createConvolver(); verbGain = ctx.createGain(); verbGain.gain.value = .2;
  const len = ctx.sampleRate * 2.6, ib = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ib;
  bus.connect(comp); bus.connect(verbGain); verbGain.connect(verb); verb.connect(comp);
  comp.connect(ctx.destination);
  const nl = ctx.sampleRate * .5; noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function nz(t, dur, hp, gain) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + .02);
}
function line(t, n, dur, acc, sld, prev, tone, padish, vel) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;                       // a completed fade-out is silence
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = o2.type = tone.wave; o2.detune.value = padish ? 9 : 4;
  if (sld && prev != null) {
    o.frequency.setValueAtTime(hz(prev), t); o2.frequency.setValueAtTime(hz(prev), t);
    const e = t + Math.min(.11, dur * .55);
    o.frequency.exponentialRampToValueAtTime(hz(n), e);
    o2.frequency.exponentialRampToValueAtTime(hz(n), e);
  } else { o.frequency.setValueAtTime(hz(n), t); o2.frequency.setValueAtTime(hz(n), t); }
  f.type = "lowpass"; f.Q.value = tone.q;
  const co = tone.cut * (acc ? 2.4 : 1);
  f.frequency.setValueAtTime(Math.min(11000, co * 3.4), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(160, co), t + Math.max(.06, dur * .85));
  const pk = tone.gain * (0.18 + 0.82 * lvl) * (acc ? 1.12 : 1);
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + tone.atk);
  g.gain.setValueAtTime(pk, t + Math.max(tone.atk, dur * .7));
  g.gain.exponentialRampToValueAtTime(.0008, t + dur + tone.rel * .25);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(bus);
  const off = t + dur + tone.rel * .25 + .05;
  o.start(t); o2.start(t); o.stop(off); o2.stop(off);
}
function hit(t, d, acc, vel) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;
  const a = (acc ? 1.15 : .85) * (0.45 + 0.55 * lvl);
  if (d === "k") { const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(126, t); o.frequency.exponentialRampToValueAtTime(43, t + .09);
    g.gain.setValueAtTime(.95 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .34);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .36); }
  else if (d === "s") { nz(t, .19, 900, .42 * a);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle";
    o.frequency.setValueAtTime(196, t);
    g.gain.setValueAtTime(.3 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .15); }
  else if (d === "c") { [0, .011, .023].forEach(o2 => nz(t + o2, .1, 1400, .3 * a)); }
  else if (d === "o") { nz(t, .26, 6600, .14 * a); }
  else if (d === "h") { nz(t, .035, 7800, .13 * a); }
  else if (d === "p") { nz(t, .05, 2600, .16 * a); }
}

/* ---------- scheduler ---------- */
let TL = [];
function compile() {
  TL = [];
  const list = loopOnly == null ? SONG.map((s, i) => [s, i]) : [[SONG[loopOnly], loopOnly]];
  for (const [sec, si] of list) {
    if (!sec.genre) continue;                                // empty boxes are skipped
    const { g, bars, ev } = sectionEvents(sec);
    const barSteps = 16 / g.rate;
    for (let b = 0; b < bars; b++)
      TL.push({ si, g, barSteps, first: b === 0,
                ev: ev.filter(e => Math.floor(e.t / barSteps) === b)
                      .map(e => ({ ...e, off: e.t - b * barSteps })) });
  }
}
const stepDur = () => 60 / (+document.getElementById("bpm").value) / 4;

function tick() {
  if (!playing || !TL.length) return;
  const sd = stepDur(), look = ctx.currentTime + .15;
  while (nextBarTime < look) {
    if (nextBar >= TL.length) nextBar = 0;
    const bar = TL[nextBar];
    if (bar.first) { passStart = nextBarTime; showSection(bar.si); }
    for (const e of bar.ev) {
      const when = nextBarTime + e.off * sd;
      if (e.kind === "line") line(when, e.n, e.dur * sd, e.acc, e.sld, e.prev, bar.g.tone, e.pad, e.vel);
      else if (e.kind === "hit") hit(when, e.d, e.acc, e.vel);
      else if (e.kind === "bass") line(when, e.n, e.dur * sd, 1, 0, null,
        { wave: "square", cut: 340, q: 5, atk: .006, rel: .8, gain: .26 }, false, e.vel);
    }
    nextBarTime += bar.barSteps * sd;
    nextBar = (nextBar + 1) % TL.length;
  }
}
function frame() {
  if (!playing) return;
  if (viewSec !== playingSec) {                 // looking at a box that is not sounding
    for (const p of phEls) p.style.transform = "translateX(-3px)";
    return requestAnimationFrame(frame);
  }
  const sd = stepDur();
  let x = ((ctx.currentTime - passStart) / sd) * stepW;
  x = Math.max(0, Math.min(viewSteps * stepW, x));
  for (const p of phEls) p.style.transform = "translateX(" + x + "px)";
  requestAnimationFrame(frame);
}
function startAt(boxIndex) {
  initAudio(); if (ctx.state === "suspended") ctx.resume();
  compile();
  if (!TL.length) {
    document.getElementById("readout").textContent =
      "nothing to play — click a genre to fill a box first";
    return;
  }
  const at = TL.findIndex(b => b.si === boxIndex && b.first);
  playing = true; playingSec = -1;
  nextBar = at < 0 ? 0 : at;
  nextBarTime = ctx.currentTime + .08; passStart = nextBarTime;
  document.getElementById("play").textContent = "■ Stop";
  clearInterval(timer); timer = setInterval(tick, 25); requestAnimationFrame(frame);
  drawSong();
}
function stop() {
  playing = false; clearInterval(timer); playingSec = -1;
  document.getElementById("play").textContent = "▶ Play";
  for (const p of phEls) p.style.transform = "translateX(-3px)";
  drawSong();
}

/* ---------- clicking things on and off in the selected box ---------- */
function toggle(kind, value) {
  const sec = curSection();
  if (kind === "genre") {
    if (sec.genre === value) { SONG[viewSec] = emptyBox(); }
    else { sec.genre = value; if (!sec.len) sec.len = GENRES[value].bars;
           sec.nudge = sec.nudge % GENRES[value].bars; }
  } else if (kind === "phrase") {
    if (!sec.genre) return;
    const i = sec.slots.indexOf(value);
    i < 0 ? sec.slots.push(value) : sec.slots.splice(i, 1);
  } else if (kind === "op") {
    const i = sec.ops.indexOf(value);
    i < 0 ? sec.ops.push(value) : sec.ops.splice(i, 1);
  } else if (kind === "env") sec.env = sec.env === value ? null : value;
  else if (kind === "mode") sec.mode = sec.mode === value ? null : value;
  else if (kind === "rate") sec.rate = sec.rate === value ? null : value;
  songChanged();
}
function songChanged() { drawSong(); draw(); drawSlots(); if (playing) compile(); }

/* ---------- the song row ---------- */
function drawSong() {
  const el = document.getElementById("song"); el.innerHTML = "";
  SONG.forEach((sec, i) => {
    const bars = boxBars(sec);
    const box = document.createElement("div");
    box.className = "box" + (sec.genre ? " full" : " empty") +
      (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "") +
      (i === loopOnly ? " looped" : "");
    box.style.width = (sec.genre ? Math.max(116, bars * PX_PER_BAR) : 116) + "px";
    box.draggable = true;
    box.setAttribute("aria-label", "box " + (i + 1) +
      (sec.genre ? ", " + GENRES[sec.genre].label + ", " + bars + " bars" : ", empty"));

    const head = document.createElement("div"); head.className = "bhead";
    head.innerHTML = "<b>" + (i + 1) + "</b><span>" +
      (sec.genre ? bars + " bar" + (bars === 1 ? "" : "s") +
        (sec.nudge ? " +" + sec.nudge : "") : "empty") + "</span>" +
      (i === loopOnly ? '<span class="loopmark">loop</span>' : "");
    box.append(head);

    const gl = document.createElement("div");
    gl.className = "bgenre" + (sec.genre ? " has" : "");
    gl.textContent = sec.genre ? GENRES[sec.genre].label : "click a genre";
    box.append(gl);

    const ph = document.createElement("div");
    ph.className = "bphrase" + (sec.slots.length ? " has" : "");
    if (!sec.slots.length) ph.textContent = sec.genre ? "click a phrase" : "";
    else for (const si of sec.slots) {
      const p = SLOTS[si], row = document.createElement("span"); row.className = "mini";
      for (let k = 0; k < 16; k++) {
        const c = document.createElement("i");
        if (p.gate[k]) { c.className = "on";
          c.style.height = (18 + (p.deg[k] + 7) / 14 * 60) + "%";
          c.style.opacity = String(0.35 + (p.vel[k] / 9) * 0.65); }
        row.append(c);
      }
      ph.append(row);
    }
    box.append(ph);

    const tags = document.createElement("div"); tags.className = "btags";
    for (const o of sec.ops) tags.append(Object.assign(document.createElement("span"),
      { className: "tag", textContent: OPLABEL[o] }));
    if (sec.mode) tags.append(Object.assign(document.createElement("span"),
      { className: "tag mode", textContent: MODELABEL[sec.mode] }));
    if (sec.rate) tags.append(Object.assign(document.createElement("span"),
      { className: "tag rate", textContent: RATELABEL[sec.rate] }));
    if (sec.env) tags.append(Object.assign(document.createElement("span"),
      { className: "tag env", textContent: ENVLABEL[sec.env] }));
    box.append(tags);

    // REORDER — boxes drag among themselves, and that is all dragging does now.
    box.addEventListener("dragstart", e => {
      dragFrom = i; box.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    });
    box.addEventListener("dragend", () => { dragFrom = null; drawSong(); });
    box.addEventListener("dragover", e => {
      if (dragFrom == null || dragFrom === i) return;
      e.preventDefault(); box.classList.add("over");
    });
    box.addEventListener("dragleave", () => box.classList.remove("over"));
    box.addEventListener("drop", e => {
      e.preventDefault(); box.classList.remove("over");
      if (dragFrom == null || dragFrom === i) return;
      const [moved] = SONG.splice(dragFrom, 1);
      SONG.splice(i, 0, moved);
      viewSec = i; dragFrom = null; songChanged();
      if (playing) { compile(); nextBar = 0; }
    });

    // CLICK plays from here and carries on; DOUBLE-CLICK loops this box alone.
    box.addEventListener("click", e => {
      if (e.target.closest(".grip")) return;
      viewSec = i; loopOnly = null;
      drawSong(); draw(); drawSlots();
      if (sec.genre) startAt(i);                // an empty box is only selected
    });
    box.addEventListener("dblclick", e => {
      if (e.target.closest(".grip") || !sec.genre) return;
      viewSec = i; loopOnly = i;
      drawSong(); draw(); drawSlots(); startAt(i);
    });

    if (sec.genre) {
      // LEFT grip nudges the window into the genre's form; RIGHT grip sets its
      // length. Trimming a clip from either end, which is the DAW gesture.
      const gN = GENRES[sec.genre].bars;
      box.append(makeGrip("l", e0 => {
        const n0 = sec.nudge;
        return dx => {
          const n = Math.max(0, Math.min(gN - 1, n0 + Math.round(dx / BAR_PX)));
          if (n !== sec.nudge) { sec.nudge = n; songChanged(); }
        };
      }));
      box.append(makeGrip("r", e0 => {
        const l0 = sec.len;
        return dx => {
          const n = Math.max(1, Math.min(MAX_LEN, l0 + Math.round(dx / BAR_PX)));
          if (n !== sec.len) { sec.len = n; songChanged(); }
        };
      }));
    }
    el.append(box);
  });
}
function makeGrip(side, begin) {
  const g = document.createElement("div");
  g.className = "grip " + side;
  g.title = side === "l" ? "drag to nudge into the form" : "drag to set length";
  g.draggable = false;
  g.addEventListener("dragstart", e => e.preventDefault());
  g.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, apply = begin(e);
    const move = ev => apply(ev.clientX - x0);
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  });
  g.addEventListener("click", e => e.stopPropagation());
  return g;
}

/* ---------- palette: click on / off in the selected box ---------- */
function drawPalette() {
  const el = document.getElementById("palette"); el.innerHTML = "";
  const sec = curSection();
  const group = (title, items) => {
    const g = document.createElement("div"); g.className = "pgroup";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
    for (const [kind, value, label, on, cls] of items) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pchip " + (cls || "") + (on ? " on" : "");
      b.textContent = label; b.setAttribute("aria-pressed", String(!!on));
      b.addEventListener("click", () => toggle(kind, value));
      g.append(b);
    }
    el.append(g);
  };
  group("genre", Object.keys(GENRES).map(k =>
    ["genre", k, GENRES[k].label, sec.genre === k, "gen"]));
  group("pattern", Object.keys(OPS).map(k =>
    ["op", k, OPLABEL[k], sec.ops.includes(k), ""]));
  group("mode", Object.keys(MODES).map(k =>
    ["mode", k, MODELABEL[k], sec.mode === k, "mode"]));
  group("tempo", Object.keys(RATES).map(k =>
    ["rate", k, RATELABEL[k], sec.rate === k, "rate"]));
  group("envelope", [["env", "in", "fade in", sec.env === "in", "env"],
                     ["env", "out", "fade out", sec.env === "out", "env"]]);
}

/* ---------- phrase slots: click toggles into the box AND opens the editor --- */
function drawSlots() {
  const el = document.getElementById("slots"); el.innerHTML = "";
  const sec = curSection();
  SLOTS.forEach((p, i) => {
    const inBox = sec.slots.includes(i);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (i === slot ? " sel" : "") + (inBox ? " inbox" : "");
    b.setAttribute("aria-pressed", String(inBox));
    b.setAttribute("aria-label", "phrase " + (i + 1) + (isBlank(p) ? ", empty" : ", filled") +
      (inBox ? ", in box " + (viewSec + 1) : ""));
    const mini = document.createElement("span"); mini.className = "mini";
    for (let k = 0; k < 16; k++) {
      const c = document.createElement("i");
      if (p.gate[k]) { c.className = "on";
        c.style.height = (18 + (p.deg[k] + 7) / 14 * 60) + "%";
        c.style.opacity = String(0.35 + (p.vel[k] / 9) * 0.65); }
      mini.append(c);
    }
    b.append(Object.assign(document.createElement("span"),
      { className: "sn", textContent: (i + 1) + (isBlank(p) ? "" : " •") }), mini);
    b.addEventListener("click", () => {
      slot = i; SUBJ = SLOTS[i];
      toggle("phrase", i);
      drawSlots(); drawEditor();
    });
    el.append(b);
  });
}

/* ---------- slot editor ---------- */
const ROWS = ["deg", "oct", "vel", "gate", "acc", "sld"];
const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9] };
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

function drawEditor() {
  const el = document.getElementById("stepgrid"); el.innerHTML = "";
  document.getElementById("edslot").textContent = "phrase " + (slot + 1);
  el.append(Object.assign(document.createElement("div"), { className: "rowlab" }));
  for (let i = 0; i < 16; i++)
    el.append(Object.assign(document.createElement("div"),
      { className: "num" + (i % 4 === 0 ? " q" : ""), textContent: String(i + 1) }));
  for (const key of ROWS) {
    el.append(Object.assign(document.createElement("div"),
      { className: "rowlab", textContent: key }));
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button"); b.type = "button";
      const num = RANGE[key], val = SUBJ[key][i];
      if (num) {
        b.className = "cell deg" + (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : "");
        b.textContent = key === "vel" ? String(val) : (val > 0 ? "+" + val : String(val));
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + " " + val);
      } else {
        b.className = "cell" + (val ? " on" : "");
        b.textContent = val ? "●" : "";
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + (val ? " on" : " off"));
      }
      b.addEventListener("click", ev => {
        if (num) SUBJ[key][i] = clamp(val + (ev.shiftKey ? -1 : 1), num);
        else SUBJ[key][i] = val ? 0 : 1;
        drawEditor(); drawSlots(); drawSong(); draw(); if (playing) compile();
      });
      el.append(b);
    }
  }
}

/* ---------- what the selected box asks for ---------- */
function writeSrc() {
  const sec = curSection(), out = document.getElementById("src");
  if (!sec.genre) { out.textContent = "(empty box)"; return; }
  const g = genreOf(sec);
  const kit = Object.keys(g.kit || {}).length
    ? Object.entries(g.kit).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  out.innerHTML =
    g.label.toUpperCase() + "\n\n" +
    "form       " + g.bars + " bars\n" +
    "window     " + sec.len + " bars from bar " + (sec.nudge % g.bars + 1) + "\n" +
    "phrases    " + (sec.slots.length
      ? sec.slots.map(i => i + 1).join(", ") + "  (voice v plays phrase v mod " + sec.slots.length + ")"
      : "none") + "\n" +
    "rate       " + g.rate + (sec.rate ? "  (" + RATELABEL[sec.rate] + ")" : "") +
      (g.swing ? "   swing " + g.swing.toFixed(2) : "") + "\n" +
    "scale      " + (g.scale ? "[" + g.scale.join(" ") + "]  (blues — flat five)"
                             : "[0 3 5 7 10]  (minor pentatonic)") + "\n" +
    "harmony    " + g.harmony + (g.roots ? "  [" + g.roots.map(r => ROMAN[r]).join(" ") + "]" : "") + "\n" +
    "mode       " + (sec.mode ? MODELABEL[sec.mode] + "  [" + MODES[sec.mode].join(" ") + "]"
                              : "natural minor  [0 2 3 5 7 8 10]") + "\n" +
    "transforms " + (sec.ops.length || sec.env
      ? [...sec.ops.map(o => OPLABEL[o]), ...(sec.env ? [ENVLABEL[sec.env]] : [])].join(" + ")
      : "none") + "\n\n" +
    "kit\n" + kit;
}

/* ---------- wiring ---------- */
document.getElementById("play").addEventListener("click",
  () => playing ? stop() : (loopOnly = null, startAt(0)));
document.getElementById("bpm").addEventListener("input", e => {
  document.getElementById("bpmv").textContent = e.target.value;
});
document.getElementById("addbox").addEventListener("click", () => {
  SONG.push(emptyBox()); viewSec = SONG.length - 1; songChanged(); drawSlots();
});
document.getElementById("delbox").addEventListener("click", () => {
  if (SONG.length > 1) SONG.splice(viewSec, 1); else SONG[0] = emptyBox();
  viewSec = Math.min(viewSec, SONG.length - 1); loopOnly = null;
  songChanged(); drawSlots();
});
const putPhrase = make => () => {
  SLOTS[slot] = make(); SUBJ = SLOTS[slot];
  drawSlots(); drawEditor(); drawSong(); draw(); if (playing) compile();
};
document.getElementById("seed").addEventListener("click", putPhrase(() => structuredClone(DEFAULT)));
document.getElementById("rnd").addEventListener("click", putPhrase(randomPhrase));
document.getElementById("clear").addEventListener("click", putPhrase(blank));
document.getElementById("reset").addEventListener("click", () => {
  if (playing) stop();
  SLOTS = Array.from({ length: NSLOTS }, blank); slot = 0; SUBJ = SLOTS[0];
  SONG = Array.from({ length: NBOXES }, emptyBox);
  viewSec = 0; playingSec = -1; loopOnly = null;
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  drawSlots(); drawEditor(); drawSong(); draw();
  document.getElementById("dawscroll").scrollLeft = 0;
});
addEventListener("resize", () => draw());

drawSlots(); drawEditor(); drawSong(); draw();
