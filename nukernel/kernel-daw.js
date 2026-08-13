// kernel-daw.js — the UI ONLY: arrangement view, phrase editor, WebAudio.
// The algebra is kernel.js and the genre table is genres.js; both are loaded
// before this file (see kernel-daw.html). Nothing musical is decided here.
//
// Scheduling is BAR AT A TIME, not one flat event list, because the bar is the
// unit the user switches genres on: a tab click sets `pending` and the swap
// happens at the next bar line, so the bar you are hearing always finishes.
const { harm, render, drums, bass, ROMAN, word, drop, envelope,
        reverse, invert, rotate } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME } = window.NuGenres;

const DEFAULT_GENRE = "acid", DEFAULT_BPM = 126, NSLOTS = 8;
const blank = () => ({ deg: z(), oct: z(), vel: new Array(16).fill(5),
                       gate: z(), acc: z(), sld: z() });
function z() { return new Array(16).fill(0); }

// EIGHT SLOTS, all blank on load. A slot holds a phrase and nothing else — no
// genre, no transforms — which is what lets the same phrase be read four ways.
let SLOTS = Array.from({ length: NSLOTS }, blank);
let slot = 0;
let SUBJ = SLOTS[slot];                       // by reference: cell edits mutate the slot
let cur = DEFAULT_GENRE, pending = null;

// A SECTION is genre + slot + transforms, and `reps` counts LOOPS OF THE GENRE
// rather than bars: a section is always a whole number of the genre's own form,
// so a twelve-bar blues is never cut to eight and acid is never cut mid-word.
// TRANSFORMS are two types kept in two fields on purpose — `ops` are pattern
// operators, `env` is an envelope over the section.
const OPS = { rev: reverse(), inv: invert(4), drop2: drop(2), drop3: drop(3) };
const OPLABEL = { rev: "reverse", inv: "invert", drop2: "drop 2", drop3: "drop 3" };
let SONG = [], songMode = false, playingSec = -1;

const newSection = () => ({ genre: cur, slot, reps: 1, ops: [], env: null });

function selectSlot(i) {
  slot = i; SUBJ = SLOTS[i];
  drawSlots(); drawEditor(); draw(); if (playing) compile();
}
function putSlot(phrase) {
  SLOTS[slot] = phrase; SUBJ = SLOTS[slot];
  drawSlots(); drawEditor(); draw(); if (playing) compile();
}
const isBlank = p => p.gate.every(g => !g);

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

function drawSlots() {
  const el = document.getElementById("slots"); el.innerHTML = "";
  SLOTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot" + (i === slot ? " sel" : "");
    b.setAttribute("aria-pressed", String(i === slot));
    b.setAttribute("aria-label", "phrase slot " + (i + 1) + (isBlank(p) ? ", empty" : ", filled"));
    const mini = document.createElement("span"); mini.className = "mini";
    for (let k = 0; k < 16; k++) {
      const c = document.createElement("i");
      if (p.gate[k]) {
        c.className = "on";
        c.style.height = (18 + (p.deg[k] + 7) / 14 * 60) + "%";
        c.style.opacity = String(0.35 + (p.vel[k] / 9) * 0.65);
      }
      mini.append(c);
    }
    b.append(Object.assign(document.createElement("span"),
      { className: "sn", textContent: (i + 1) + (isBlank(p) ? "" : " •") }), mini);
    b.addEventListener("click", () => selectSlot(i));
    el.append(b);
  });
}

/* ---------- arrangement model ---------- */
let viewSec = 0;
const curSection = () => (songMode && SONG.length)
  ? SONG[Math.min(viewSec, SONG.length - 1)] : newSection();

function showSection(si) {
  if (!songMode || si === playingSec) return;
  playingSec = si; viewSec = si; draw(); drawSong();
}

function build() {
  const sec = curSection();
  const { g, bars, ev } = sectionEvents(sec);
  const lanes = [];
  for (let v = 0; v < g.voices; v++)
    lanes.push({ id: "v" + v, name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: g.words[v] || "", kind: "pitch", color: "var(--v" + v + ")",
      ev: ev.filter(e => e.kind === "line" && e.v === v) });
  lanes.push({ id: "bass", name: "Bass",
    op: (g.bassStyle === "walk" ? "walking · " : "roots · ") + g.harmony,
    kind: "pitch", color: "var(--vb)", ev: ev.filter(e => e.kind === "bass") });
  const hits = ev.filter(e => e.kind === "hit");
  for (const d of [...new Set(hits.map(e => e.d))])
    lanes.push({ id: "d" + d, name: DRUMNAME[d] || d,
      op: d === "p" ? "only(acc, rotate 3)"
        : (g.fill && g.fill[d]) ? "grid + fill every " + g.bars : "grid",
      kind: "drum", color: "var(--drum)", ev: hits.filter(e => e.d === d) });
  return { g, bars, lanes, steps: bars * 16 / g.rate, sec };
}

/* ---------- draw ---------- */
const gridEl = document.getElementById("grid");
let stepW = 7, model = null, phEls = [], viewSteps = 64;

function draw() {
  model = build();
  const { g, lanes, steps, bars } = model;
  const avail = Math.max(560, document.getElementById("dawscroll").clientWidth - 118);
  stepW = Math.max(5, Math.min(22, avail / steps));
  viewSteps = steps;
  const W = steps * stepW;
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = "118px " + W + "px";

  const pad = document.createElement("div"); pad.className = "rulerpad"; gridEl.append(pad);
  const ruler = document.createElement("div"); ruler.className = "ruler";
  for (let b = 0; b < bars; b++) {
    const t = document.createElement("div"); t.className = "tick b";
    t.style.left = (b * 16 * stepW / g.rate) + "px";
    t.textContent = "bar " + (b + 1) + (b === bars - 1 && g.fill ? " · fill" : "");
    ruler.append(t);
  }
  gridEl.append(ruler);

  phEls = [];
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
        d.style.opacity = String(0.25 + 0.75 * ((e.vel == null ? 5 : e.vel) / 9));
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
    : "roots " + Array.from({ length: bars }, (_, b) => ROMAN[harm(SUBJ, g, b)]).join(" → ") +
      (g.harmony === "emergent" ? " (computed, not written)" : "");
  const { sec } = model;
  const tag = songMode && SONG.length
    ? "section " + (viewSec + 1) + "/" + SONG.length + " · phrase " + (sec.slot + 1) +
      (sec.ops.length ? " · " + sec.ops.map(o => OPLABEL[o]).join(" + ") : "") +
      (sec.env ? " · fade " + sec.env : "") + " · "
    : "";
  document.getElementById("readout").textContent =
    tag + bars + " bars · rate " + g.rate + " · " + g.voices + " voices · harmony " +
    g.harmony + " · " + roots;
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
  // vel is the level; acc is timbre (the filter boost above) plus a small lift
  const pk = tone.gain * (0.18 + 0.82 * ((vel == null ? 5 : vel) / 9)) * (acc ? 1.12 : 1);
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + tone.atk);
  g.gain.setValueAtTime(pk, t + Math.max(tone.atk, dur * .7));   // HOLD, then release
  g.gain.exponentialRampToValueAtTime(.0008, t + dur + tone.rel * .25);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(bus);
  const off = t + dur + tone.rel * .25 + .05;
  o.start(t); o2.start(t); o.stop(off); o2.stop(off);
}
function hit(t, d, acc, vel) {
  const a = (acc ? 1.15 : .85) * (0.45 + 0.55 * ((vel == null ? 5 : vel) / 9));
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
  else if (d === "p") { nz(t, .05, 2600, .16); }
}

/* ---------- bar-at-a-time scheduler ---------- */
// TL is a flat list of bars for whatever is playing — a single genre loop in
// loop mode, the whole section list in song mode. The scheduler walks it and
// never needs to know which mode it is in.
let TL = [];

// Everything one section contributes, already transformed.
function sectionEvents(sec) {
  const g = GENRES[sec.genre], bars = g.bars * sec.reps;
  const phrase = word(SLOTS[sec.slot], sec.ops.map(o => OPS[o]));
  const span = bars * 16 / g.rate;
  const out = [];
  const pitched = render(phrase, g, bars);
  for (let v = 0; v < g.voices; v++) {
    let prev = null;
    for (const e of pitched.filter(e => e.v === v)) {
      out.push({ ...e, kind: "line", prev, pad: g.realize(v) === "pad" });
      prev = e.n;
    }
  }
  // Drums repeat PER GENRE-LOOP so the fill lands at the end of every form, not
  // once at the end of the section. The pitched voices do NOT: their section
  // counter has to run continuously or acid's rotate(4·section) resets.
  const dr = drums(phrase, g, g.bars), loopSteps = g.bars * 16 / g.rate;
  for (let r = 0; r < sec.reps; r++)
    for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
  for (const e of bass(phrase, g, bars)) out.push({ ...e, kind: "bass" });
  return { g, bars, span, phrase, ev: envelope(out, sec.env, span) };
}

function compile() {
  const secs = (songMode && SONG.length) ? SONG : [newSection()];
  TL = [];
  secs.forEach((sec, si) => {
    const { g, bars, ev } = sectionEvents(sec);
    const barSteps = 16 / g.rate;
    for (let b = 0; b < bars; b++)
      TL.push({ si, g, barSteps, first: b === 0, bars,
                ev: ev.filter(e => Math.floor(e.t / barSteps) === b)
                      .map(e => ({ ...e, off: e.t - b * barSteps })) });
  });
}
const stepDur = () => 60 / (+document.getElementById("bpm").value) / 4;

function applyPending() {
  cur = pending; pending = null;
  syncTabs(); compile(); draw(); writeSrc();
}
function tick() {
  if (!playing || !TL.length) return;
  const sd = stepDur(), look = ctx.currentTime + .15;
  while (nextBarTime < look) {
    // a genre swap lands HERE — on the bar line, after the sounding bar
    // finishes. Song mode ignores it: the section list decides the genre.
    if (pending && !songMode) { nextBar = 0; applyPending(); }
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
  if (x < 0) x = 0;
  const max = viewSteps * stepW;
  if (x > max) x = max;
  for (const p of phEls) p.style.transform = "translateX(" + x + "px)";
  requestAnimationFrame(frame);
}
function start() {
  initAudio(); if (ctx.state === "suspended") ctx.resume();
  compile();
  playing = true; nextBar = 0; nextBarTime = ctx.currentTime + .08; passStart = nextBarTime;
  document.getElementById("play").textContent = "■ Stop";
  timer = setInterval(tick, 25); requestAnimationFrame(frame);
}
function stop() {
  playing = false; clearInterval(timer); pending = null; syncTabs();
  document.getElementById("play").textContent = "▶ Play";
  for (const p of phEls) p.style.transform = "translateX(-3px)";
}

/* ---------- phrase editor ---------- */
// deg and oct are SIGNED integer rows; gate/acc/sld are binary toggles. The
// kernel never clamped degree — pitch() has always taken any integer and let
// Math.floor(d/len) carry the octave — it was only this editor that pinned it
// to 0..5, which made the phrase far narrower than the algebra behind it.
const ROWS = ["deg", "oct", "vel", "gate", "acc", "sld"];
const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9] };
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
function drawEditor() {
  const el = document.getElementById("stepgrid"); el.innerHTML = "";
  el.append(Object.assign(document.createElement("div"), { className: "rowlab" }));
  for (let i = 0; i < 16; i++) {
    const n = document.createElement("div");
    n.className = "num" + (i % 4 === 0 ? " q" : ""); n.textContent = i + 1; el.append(n);
  }
  for (const key of ROWS) {
    const lb = document.createElement("div"); lb.className = "rowlab"; lb.textContent = key;
    el.append(lb);
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button"); b.type = "button";
      const num = RANGE[key], val = SUBJ[key][i];
      if (num) {
        b.className = "cell deg" + (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : "");
        b.textContent = key === "vel" ? String(val) : (val > 0 ? "+" + val : String(val));
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + " " + val +
          " (click raises, shift-click lowers, range " + num[0] + " to " + num[1] + ")");
      } else {
        b.className = "cell" + (val ? " on" : "");
        b.textContent = val ? "●" : "";
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + (val ? " on" : " off"));
      }
      b.addEventListener("click", ev => {
        if (num) SUBJ[key][i] = clamp(val + (ev.shiftKey ? -1 : 1), num);
        else SUBJ[key][i] = val ? 0 : 1;
        drawEditor(); draw(); if (playing) compile();
      });
      el.append(b);
    }
  }
}

/* ---------- wiring ---------- */
const tabs = document.getElementById("tabs");
function syncTabs() {
  [...tabs.children].forEach(c => {
    c.setAttribute("aria-pressed", String(c.dataset.k === cur));
    c.classList.toggle("pending", c.dataset.k === pending);
  });
}
for (const k of Object.keys(GENRES)) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "tab"; b.dataset.k = k; b.textContent = GENRES[k].label;
  b.addEventListener("click", () => {
    if (k === cur) { pending = null; syncTabs(); return; }
    if (playing) { pending = k; syncTabs(); }      // swap on the next bar line
    else { cur = k; syncTabs(); draw(); writeSrc(); }
  });
  tabs.append(b);
}
syncTabs();

document.getElementById("play").addEventListener("click", () => playing ? stop() : start());
document.getElementById("mode").addEventListener("click", () => setMode(!songMode));
document.getElementById("addsec").addEventListener("click", () => {
  SONG.push(newSection()); viewSec = SONG.length - 1; songChanged();
});
document.getElementById("bpm").addEventListener("input", e => {
  document.getElementById("bpmv").textContent = e.target.value;
});
// These three act on the SELECTED slot. The drums keep playing through a blank
// phrase, because the kit is genre data and never came from the seed.
document.getElementById("clear").addEventListener("click", () => putSlot(blank()));
document.getElementById("seed").addEventListener("click", () => putSlot(structuredClone(DEFAULT)));

document.getElementById("rnd").addEventListener("click", () => putSlot(randomPhrase()));

// RESET ALL — every part of it: transport, pending swap, phrase, genre, tempo,
// and the scroll positions, back to the state the page loads in.
document.getElementById("reset").addEventListener("click", () => {
  if (playing) stop();
  pending = null;
  SLOTS = Array.from({ length: NSLOTS }, blank);
  slot = 0; SUBJ = SLOTS[0];
  SONG = []; viewSec = 0; playingSec = -1;
  cur = DEFAULT_GENRE;
  setMode(false);
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  syncTabs(); drawSlots(); drawEditor(); draw(); writeSrc();
  document.getElementById("dawscroll").scrollLeft = 0;
  document.querySelector(".steps").scrollLeft = 0;
});

/* ---------- song ---------- */
function setMode(on) {
  songMode = on;
  if (songMode && !SONG.length) SONG.push(newSection());
  document.getElementById("mode").textContent = songMode ? "Song" : "Loop";
  document.getElementById("mode").setAttribute("aria-pressed", String(songMode));
  document.getElementById("songpanel").hidden = !songMode;
  viewSec = 0; playingSec = -1;
  syncTabs(); drawSong(); draw(); if (playing) { compile(); nextBar = 0; nextBarTime = ctx.currentTime + .06; }
}
function songChanged() {
  drawSong(); draw(); if (playing) compile();
}
function drawSong() {
  const el = document.getElementById("seclist"); el.innerHTML = "";
  SONG.forEach((sec, i) => {
    const g = GENRES[sec.genre];
    const card = document.createElement("div");
    card.className = "sec" + (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "");

    const head = document.createElement("div"); head.className = "sechead";
    head.innerHTML = '<b>' + (i + 1) + '</b><span>' + (g.bars * sec.reps) + ' bars</span>';
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "x"; rm.textContent = "\u00d7";
    rm.setAttribute("aria-label", "remove section " + (i + 1));
    rm.addEventListener("click", () => {
      SONG.splice(i, 1); if (!SONG.length) SONG.push(newSection());
      viewSec = Math.min(viewSec, SONG.length - 1); songChanged();
    });
    head.append(rm); card.append(head);

    const mk = (label, opts, val, on) => {
      const w = document.createElement("label"); w.className = "field";
      w.append(Object.assign(document.createElement("span"), { textContent: label }));
      const sel = document.createElement("select");
      for (const [v, t] of opts) {
        const o = document.createElement("option"); o.value = v; o.textContent = t;
        if (String(v) === String(val)) o.selected = true; sel.append(o);
      }
      sel.addEventListener("change", e => { on(e.target.value); songChanged(); });
      w.append(sel); return w;
    };
    card.append(mk("genre", Object.keys(GENRES).map(k => [k, GENRES[k].label]), sec.genre,
      v => { sec.genre = v; }));
    card.append(mk("phrase", SLOTS.map((p, n) => [n, (n + 1) + (isBlank(p) ? " (empty)" : "")]), sec.slot,
      v => { sec.slot = +v; }));
    card.append(mk("repeat", [[1, "\u00d71"], [2, "\u00d72"], [4, "\u00d74"]], sec.reps,
      v => { sec.reps = +v; }));

    const chips = document.createElement("div"); chips.className = "chips";
    for (const k of Object.keys(OPS)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (sec.ops.includes(k) ? " on" : "");
      b.textContent = OPLABEL[k]; b.setAttribute("aria-pressed", String(sec.ops.includes(k)));
      b.addEventListener("click", () => {
        const j = sec.ops.indexOf(k); j < 0 ? sec.ops.push(k) : sec.ops.splice(j, 1);
        songChanged();
      });
      chips.append(b);
    }
    for (const [k, t] of [["in", "fade in"], ["out", "fade out"]]) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip env" + (sec.env === k ? " on" : "");
      b.textContent = t; b.setAttribute("aria-pressed", String(sec.env === k));
      b.addEventListener("click", () => { sec.env = sec.env === k ? null : k; songChanged(); });
      chips.append(b);
    }
    card.append(chips);
    card.addEventListener("click", e => {
      if (e.target.closest("button,select")) return;
      viewSec = i; drawSong(); draw();
    });
    el.append(card);
  });
}

function writeSrc() {
  const g = GENRES[cur];
  const kit = Object.keys(g.kit || {}).length
    ? Object.entries(g.kit).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  const fill = g.fill
    ? "\n\nfill (bar " + g.bars + ")\n" +
      Object.entries(g.fill).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : "";
  document.getElementById("src").innerHTML =
    g.label.toUpperCase() + "\n\n" +
    "bars      " + g.bars + "\n" +
    "rate      " + g.rate + (g.swing ? "   swing " + g.swing.toFixed(2) : "") + "\n" +
    "scale     " + (g.scale ? "[" + g.scale.join(" ") + "]  (blues — flat five)"
                            : "[0 3 5 7 10]  (minor pentatonic)") + "\n" +
    "voices    " + g.voices + '   <span class="c">entry ' +
      Array.from({ length: g.voices }, (_, v) => "bar " + (g.entry(v) + 1)).join(", ") + "</span>\n" +
    "harmony   " + g.harmony + (g.roots ? "  [" + g.roots.map(r => ROMAN[r]).join(" ") + "]" : "") + "\n" +
    "words     " + g.words.map((w, i) => "v" + i + " = " + w).join("\n          ") + "\n\n" +
    "kit\n" + kit + fill;
}

addEventListener("resize", () => draw());
drawSlots(); drawEditor(); setMode(false); draw(); writeSrc();
