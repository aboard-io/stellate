// kernel-daw.js — the UI ONLY. The algebra is kernel.js, the genre table is
// genres.js; both load before this file (see kernel-daw.html).
//
// THE SONG IS THE SURFACE. A song is a row of boxes; you drag a genre, a phrase
// or a transform into a box, and stretch its right edge to make it longer.
// No dropdowns, no mode switch — Play plays the song.
const { harm, render, drums, bass, ROMAN, word, drop, envelope,
        reverse, invert, rotate } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME } = window.NuGenres;

// Box width is proportional to BARS so the song reads as a timeline. Drag
// sensitivity is deliberately NOT proportional — one REP_PX of travel adds one
// loop whatever the genre, so stretching blues is not four times the effort of
// stretching acid.
const DEFAULT_BPM = 126, NSLOTS = 8, NBOXES = 4;
const PX_PER_BAR = 22, REP_PX = 70, MAX_REPS = 8;

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
// A BOX is genre + phrase + transforms + length. Empty boxes are skipped, so the
// song plays while you are still building it. `reps` counts whole loops of the
// genre, never bars — which is what keeps a twelve-bar blues from being cut to
// eight when you stretch it.
const OPS = { rev: reverse(), inv: invert(4), drop2: drop(2), drop3: drop(3) };
const OPLABEL = { rev: "reverse", inv: "invert", drop2: "drop 2", drop3: "drop 3" };
const ENVLABEL = { in: "fade in", out: "fade out" };

const emptyBox = () => ({ genre: null, slot: null, reps: 1, ops: [], env: null });
let SONG = Array.from({ length: NBOXES }, emptyBox);
let viewSec = 0, playingSec = -1, armed = null;

const boxBars = b => (b.genre ? GENRES[b.genre].bars * b.reps : 0);
const phraseOf = b => (b.slot == null ? blank() : SLOTS[b.slot]);
const curSection = () => SONG[Math.min(viewSec, SONG.length - 1)];

/* ---------- what a box contributes ---------- */
function sectionEvents(sec) {
  if (!sec.genre) return { g: null, bars: 0, span: 0, ev: [] };
  const g = GENRES[sec.genre], bars = g.bars * sec.reps;
  const phrase = word(phraseOf(sec), sec.ops.map(o => OPS[o]));
  const span = bars * 16 / g.rate, out = [];

  const pitched = render(phrase, g, bars);
  for (let v = 0; v < g.voices; v++) {
    let prev = null;
    for (const e of pitched.filter(e => e.v === v)) {
      out.push({ ...e, kind: "line", prev, pad: g.realize(v) === "pad" });
      prev = e.n;
    }
  }
  // Drums repeat PER GENRE-LOOP so the fill lands at the end of every form, not
  // once at the end of a stretched box. The pitched voices deliberately do not:
  // their section counter must run continuously or acid's rotate(4·section)
  // resets every four bars.
  const dr = drums(phrase, g, g.bars), loopSteps = g.bars * 16 / g.rate;
  for (let r = 0; r < sec.reps; r++)
    for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
  for (const e of bass(phrase, g, bars)) out.push({ ...e, kind: "bass" });

  return { g, bars, span, ev: envelope(out, sec.env, span) };
}

/* ---------- arrangement view of the selected box ---------- */
const gridEl = document.getElementById("grid");
let stepW = 7, phEls = [], viewSteps = 64;

function showSection(si) {
  if (si === playingSec) return;
  playingSec = si; viewSec = si; draw(); drawSong();
}

function draw() {
  const sec = curSection(), { g, bars, ev } = sectionEvents(sec);
  gridEl.innerHTML = ""; phEls = [];
  writeSrc();
  if (!g) {
    document.getElementById("readout").textContent =
      "box " + (viewSec + 1) + " is empty — drag a genre into it";
    return;
  }
  const lanes = [];
  for (let v = 0; v < g.voices; v++)
    lanes.push({ name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: g.words[v] || "", kind: "pitch", color: "var(--v" + v + ")",
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
    t.textContent = "bar " + (b + 1);
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
    : "roots " + Array.from({ length: bars }, (_, b) => ROMAN[harm(phraseOf(sec), g, b)]).join(" ") +
      (g.harmony === "emergent" ? " (computed, not written)" : "");
  document.getElementById("readout").textContent =
    "box " + (viewSec + 1) + " · " + GENRES[sec.genre].label + " · " +
    (sec.slot == null ? "no phrase" : "phrase " + (sec.slot + 1)) + " · " +
    bars + " bars · " + roots;
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

/* ---------- scheduler: one flat list of bars for the whole song ---------- */
let TL = [];
function compile() {
  TL = [];
  SONG.forEach((sec, si) => {
    if (!sec.genre) return;                                  // empty boxes are skipped
    const { g, bars, ev } = sectionEvents(sec);
    const barSteps = 16 / g.rate;
    for (let b = 0; b < bars; b++)
      TL.push({ si, g, barSteps, first: b === 0,
                ev: ev.filter(e => Math.floor(e.t / barSteps) === b)
                      .map(e => ({ ...e, off: e.t - b * barSteps })) });
  });
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
  const sd = stepDur();
  let x = ((ctx.currentTime - passStart) / sd) * stepW;
  x = Math.max(0, Math.min(viewSteps * stepW, x));
  for (const p of phEls) p.style.transform = "translateX(" + x + "px)";
  requestAnimationFrame(frame);
}
function start() {
  initAudio(); if (ctx.state === "suspended") ctx.resume();
  compile();
  if (!TL.length) {
    document.getElementById("readout").textContent =
      "nothing to play — drag a genre into a box first";
    return;
  }
  playing = true; nextBar = 0; playingSec = -1;
  nextBarTime = ctx.currentTime + .08; passStart = nextBarTime;
  document.getElementById("play").textContent = "■ Stop";
  timer = setInterval(tick, 25); requestAnimationFrame(frame);
}
function stop() {
  playing = false; clearInterval(timer); playingSec = -1;
  document.getElementById("play").textContent = "▶ Play";
  for (const p of phEls) p.style.transform = "translateX(-3px)";
  drawSong();
}

/* ---------- drag and drop, with click-to-place as the touch fallback ------- */
const payload = (kind, value) => JSON.stringify({ kind, value });
function syncArmed() {
  document.querySelectorAll("[data-src]").forEach(el => {
    const i = el.dataset.src.indexOf(":");
    const k = el.dataset.src.slice(0, i), v = el.dataset.src.slice(i + 1);
    el.classList.toggle("armed", !!armed && armed.kind === k && String(armed.value) === v);
  });
  document.getElementById("song").classList.toggle("targeting", !!armed);
}
function makeSource(el, kind, value) {
  el.dataset.src = kind + ":" + value;
  el.draggable = true;
  el.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", payload(kind, value));
    e.dataTransfer.effectAllowed = "copy";
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));
}
function applyTo(sec, kind, value) {
  if (kind === "genre") sec.genre = value;
  else if (kind === "phrase") sec.slot = +value;
  else if (kind === "op") {
    const i = sec.ops.indexOf(value);
    i < 0 ? sec.ops.push(value) : sec.ops.splice(i, 1);
  } else if (kind === "env") sec.env = sec.env === value ? null : value;
  songChanged();
}
function songChanged() { drawSong(); draw(); if (playing) compile(); }

/* ---------- the song row ---------- */
function drawSong() {
  const el = document.getElementById("song"); el.innerHTML = "";
  SONG.forEach((sec, i) => {
    const bars = boxBars(sec);
    const box = document.createElement("div");
    box.className = "box" + (sec.genre ? " full" : " empty") +
      (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "");
    box.style.width = (sec.genre ? Math.max(116, bars * PX_PER_BAR) : 116) + "px";
    box.setAttribute("aria-label", "box " + (i + 1) +
      (sec.genre ? ", " + GENRES[sec.genre].label + ", " + bars + " bars" : ", empty"));

    const head = document.createElement("div"); head.className = "bhead";
    head.innerHTML = "<b>" + (i + 1) + "</b><span>" +
      (sec.genre ? bars + " bars" : "empty") + "</span>";
    if (sec.genre) {
      const x = document.createElement("button");
      x.type = "button"; x.className = "x"; x.textContent = "×";
      x.setAttribute("aria-label", "empty box " + (i + 1));
      x.addEventListener("click", ev => { ev.stopPropagation(); SONG[i] = emptyBox(); songChanged(); });
      head.append(x);
    }
    box.append(head);

    const gl = document.createElement("div");
    gl.className = "bgenre" + (sec.genre ? " has" : "");
    gl.textContent = sec.genre ? GENRES[sec.genre].label : "drop a genre";
    box.append(gl);

    const ph = document.createElement("div");
    ph.className = "bphrase" + (sec.slot == null ? "" : " has");
    if (sec.slot == null) ph.textContent = "drop a phrase";
    else {
      const p = SLOTS[sec.slot];
      const mini = document.createElement("span"); mini.className = "mini";
      for (let k = 0; k < 16; k++) {
        const c = document.createElement("i");
        if (p.gate[k]) { c.className = "on";
          c.style.height = (18 + (p.deg[k] + 7) / 14 * 60) + "%";
          c.style.opacity = String(0.35 + (p.vel[k] / 9) * 0.65); }
        mini.append(c);
      }
      ph.append(Object.assign(document.createElement("span"),
        { className: "pn", textContent: "phrase " + (sec.slot + 1) }), mini);
    }
    box.append(ph);

    const tags = document.createElement("div"); tags.className = "btags";
    for (const o of sec.ops) tags.append(Object.assign(document.createElement("span"),
      { className: "tag", textContent: OPLABEL[o] }));
    if (sec.env) tags.append(Object.assign(document.createElement("span"),
      { className: "tag env", textContent: ENVLABEL[sec.env] }));
    box.append(tags);

    box.addEventListener("dragover", e => { e.preventDefault(); box.classList.add("over"); });
    box.addEventListener("dragleave", () => box.classList.remove("over"));
    box.addEventListener("drop", e => {
      e.preventDefault(); box.classList.remove("over");
      try { const d = JSON.parse(e.dataTransfer.getData("text/plain"));
            applyTo(sec, d.kind, d.value); } catch (err) { /* not one of ours */ }
    });
    box.addEventListener("click", () => {
      if (armed) { const a = armed; armed = null; syncArmed(); applyTo(sec, a.kind, a.value); return; }
      viewSec = i; drawSong(); draw();
    });

    // STRETCH — drag the right edge. Steps in whole genre-loops, so a box can
    // only ever be a whole number of the genre's own form.
    if (sec.genre) {
      const grip = document.createElement("div");
      grip.className = "grip"; grip.title = "drag to lengthen";
      grip.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, r0 = sec.reps;
        const move = ev => {
          const n = Math.max(1, Math.min(MAX_REPS, r0 + Math.round((ev.clientX - x0) / REP_PX)));
          if (n !== sec.reps) { sec.reps = n; songChanged(); }
        };
        const up = () => {
          removeEventListener("pointermove", move); removeEventListener("pointerup", up);
        };
        addEventListener("pointermove", move); addEventListener("pointerup", up);
      });
      grip.addEventListener("click", e => e.stopPropagation());
      box.append(grip);
    }
    el.append(box);
  });
  syncArmed();
}

/* ---------- palette ---------- */
function drawPalette() {
  const el = document.getElementById("palette"); el.innerHTML = "";
  const group = (title, items) => {
    const g = document.createElement("div"); g.className = "pgroup";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
    for (const [kind, value, label, cls] of items) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pchip " + (cls || "");
      b.textContent = label;
      makeSource(b, kind, value);
      b.addEventListener("click", () => {
        armed = (armed && armed.kind === kind && armed.value === value) ? null : { kind, value };
        syncArmed();
      });
      g.append(b);
    }
    el.append(g);
  };
  group("genres", Object.keys(GENRES).map(k => ["genre", k, GENRES[k].label, "gen"]));
  group("transforms", [...Object.keys(OPS).map(k => ["op", k, OPLABEL[k], ""]),
                       ["env", "in", "fade in", "env"], ["env", "out", "fade out", "env"]]);
}

/* ---------- phrase slots — editable, and drag sources ---------- */
function drawSlots() {
  const el = document.getElementById("slots"); el.innerHTML = "";
  SLOTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot" + (i === slot ? " sel" : "");
    b.setAttribute("aria-label", "phrase " + (i + 1) + (isBlank(p) ? ", empty" : ", filled"));
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
    makeSource(b, "phrase", i);
    b.addEventListener("click", () => {
      if (armed && armed.kind === "phrase" && armed.value === i) { armed = null; syncArmed(); return; }
      armed = { kind: "phrase", value: i };
      slot = i; SUBJ = SLOTS[i];
      drawSlots(); drawEditor(); draw();
    });
    el.append(b);
  });
  syncArmed();
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
  const g = GENRES[sec.genre];
  const kit = Object.keys(g.kit || {}).length
    ? Object.entries(g.kit).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  out.innerHTML =
    g.label.toUpperCase() + "\n\n" +
    "bars       " + g.bars + " × " + sec.reps + " = " + boxBars(sec) + "\n" +
    "rate       " + g.rate + (g.swing ? "   swing " + g.swing.toFixed(2) : "") + "\n" +
    "scale      " + (g.scale ? "[" + g.scale.join(" ") + "]  (blues — flat five)"
                             : "[0 3 5 7 10]  (minor pentatonic)") + "\n" +
    "harmony    " + g.harmony + (g.roots ? "  [" + g.roots.map(r => ROMAN[r]).join(" ") + "]" : "") + "\n" +
    "transforms " + (sec.ops.length || sec.env
      ? [...sec.ops.map(o => OPLABEL[o]), ...(sec.env ? [ENVLABEL[sec.env]] : [])].join(" + ")
      : "none") + "\n\n" +
    "kit\n" + kit;
}

/* ---------- wiring ---------- */
document.getElementById("play").addEventListener("click", () => playing ? stop() : start());
document.getElementById("bpm").addEventListener("input", e => {
  document.getElementById("bpmv").textContent = e.target.value;
});
document.getElementById("addbox").addEventListener("click", () => {
  SONG.push(emptyBox()); viewSec = SONG.length - 1; songChanged();
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
  viewSec = 0; playingSec = -1; armed = null;
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  drawPalette(); drawSlots(); drawEditor(); drawSong(); draw();
  document.getElementById("dawscroll").scrollLeft = 0;
});
addEventListener("resize", () => draw());

drawPalette(); drawSlots(); drawEditor(); drawSong(); draw();
