// kernel-daw.js — the UI ONLY: arrangement view, phrase editor, WebAudio.
// The algebra is kernel.js and the genre table is genres.js; both are loaded
// before this file (see kernel-daw.html). Nothing musical is decided here.
//
// Scheduling is BAR AT A TIME, not one flat event list, because the bar is the
// unit the user switches genres on: a tab click sets `pending` and the swap
// happens at the next bar line, so the bar you are hearing always finishes.
const { harm, render, drums, bass, ROMAN } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME } = window.NuGenres;

const DEFAULT_GENRE = "acid", DEFAULT_BPM = 126;
let SUBJ = structuredClone(DEFAULT);
let cur = DEFAULT_GENRE, pending = null;

/* ---------- arrangement model ---------- */
function build() {
  const g = GENRES[cur], bars = g.bars;
  const pitched = render(SUBJ, g, bars), dr = drums(SUBJ, g, bars), bs = bass(SUBJ, g, bars);
  const lanes = [];
  for (let v = 0; v < g.voices; v++)
    lanes.push({ id: "v" + v, name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: g.words[v] || "", kind: "pitch", color: "var(--v" + v + ")",
      ev: pitched.filter(e => e.v === v) });
  lanes.push({ id: "bass", name: "Bass", op: (g.bassStyle === "walk" ? "walking · " : "roots · ") + g.harmony, kind: "pitch",
    color: "var(--vb)", ev: bs });
  for (const d of [...new Set(dr.map(e => e.d))])
    lanes.push({ id: "d" + d, name: DRUMNAME[d] || d,
      op: d === "p" ? "only(acc, rotate 3)" : (g.fill && g.fill[d]) ? "grid + fill on bar " + bars : "grid",
      kind: "drum", color: "var(--drum)", ev: dr.filter(e => e.d === d) });
  return { g, bars, lanes, steps: bars * 16 / g.rate };
}

/* ---------- draw ---------- */
const gridEl = document.getElementById("grid");
let stepW = 7, model = null, phEls = [];

function draw() {
  model = build();
  const { g, lanes, steps, bars } = model;
  const avail = Math.max(560, document.getElementById("dawscroll").clientWidth - 118);
  stepW = Math.max(5, Math.min(22, avail / steps));
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
  document.getElementById("readout").textContent =
    bars + "-bar loop · rate " + g.rate + " · " + g.voices + " voices · harmony " +
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
function line(t, n, dur, acc, sld, prev, tone, padish) {
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
  const pk = (acc ? 1 : .62) * tone.gain;
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + tone.atk);
  g.gain.setValueAtTime(pk, t + Math.max(tone.atk, dur * .7));   // HOLD, then release
  g.gain.exponentialRampToValueAtTime(.0008, t + dur + tone.rel * .25);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(bus);
  const off = t + dur + tone.rel * .25 + .05;
  o.start(t); o2.start(t); o.stop(off); o2.stop(off);
}
function hit(t, d, acc) {
  const a = acc ? 1.15 : .85;
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
let byBar = [], loopSteps = 0;
function compile() {
  const g = GENRES[cur], bars = g.bars;
  byBar = Array.from({ length: bars }, () => []);
  loopSteps = bars * 16 / g.rate;
  const pitched = render(SUBJ, g, bars);
  for (let v = 0; v < g.voices; v++) {
    let prev = null;
    for (const e of pitched.filter(e => e.v === v)) {
      byBar[Math.floor(e.t * g.rate / 16)].push({ ...e, kind: "line", prev,
        pad: g.realize(v) === "pad" });
      prev = e.n;
    }
  }
  for (const e of drums(SUBJ, g, bars)) byBar[Math.floor(e.t * g.rate / 16)].push({ ...e, kind: "hit" });
  for (const e of bass(SUBJ, g, bars)) byBar[Math.floor(e.t * g.rate / 16)].push({ ...e, kind: "bass" });
}
const stepDur = () => 60 / (+document.getElementById("bpm").value) / 4;

function applyPending() {
  cur = pending; pending = null;
  syncTabs(); compile(); draw(); writeSrc();
}
function tick() {
  if (!playing) return;
  const sd = stepDur(), look = ctx.currentTime + .15;
  while (nextBarTime < look) {
    // a genre swap lands HERE — on the bar line, after the sounding bar finishes
    if (pending) { nextBar = 0; applyPending(); }
    const g = GENRES[cur], barSteps = 16 / g.rate;
    if (nextBar === 0) passStart = nextBarTime;
    for (const e of byBar[nextBar] || []) {
      const when = nextBarTime + (e.t - nextBar * barSteps) * sd;
      if (e.kind === "line") line(when, e.n, e.dur * sd, e.acc, e.sld, e.prev, g.tone, e.pad);
      else if (e.kind === "hit") hit(when, e.d, e.acc);
      else if (e.kind === "bass") line(when, e.n, e.dur * sd, 1, 0, null,
        { wave: "square", cut: 340, q: 5, atk: .006, rel: .8, gain: .26 }, false);
    }
    nextBarTime += barSteps * sd;
    nextBar = (nextBar + 1) % g.bars;
  }
}
function frame() {
  if (!playing) return;
  const sd = stepDur();
  let x = ((ctx.currentTime - passStart) / sd) * stepW;
  if (x < 0) x = 0;
  const max = loopSteps * stepW;
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
const ROWS = ["deg", "oct", "gate", "acc", "sld"];
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
      if (key === "deg") {
        b.className = "cell deg" + (SUBJ.gate[i] ? "" : " rest");
        b.textContent = SUBJ.deg[i];
        b.setAttribute("aria-label", "step " + (i + 1) + " degree " + SUBJ.deg[i]);
      } else {
        b.className = "cell" + (SUBJ[key][i] ? " on" : "");
        b.textContent = SUBJ[key][i] ? "●" : "";
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + (SUBJ[key][i] ? " on" : " off"));
      }
      b.addEventListener("click", ev => {
        if (key === "deg") SUBJ.deg[i] = (SUBJ.deg[i] + (ev.shiftKey ? 5 : 1)) % 6;
        else SUBJ[key][i] = SUBJ[key][i] ? 0 : 1;
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
document.getElementById("bpm").addEventListener("input", e => {
  document.getElementById("bpmv").textContent = e.target.value;
});
// CLEAR — empty the phrase to a blank canvas. The drums keep playing, because
// the kit is genre data and never came from the seed.
document.getElementById("clear").addEventListener("click", () => {
  const z = () => new Array(16).fill(0);
  SUBJ = { deg: z(), oct: z(), gate: z(), acc: z(), sld: z() };
  drawEditor(); draw(); if (playing) compile();
});

document.getElementById("rnd").addEventListener("click", () => {
  const r = n => Math.floor(Math.random() * n);
  for (let i = 0; i < 16; i++) {
    SUBJ.deg[i] = r(6); SUBJ.oct[i] = r(6) === 0 ? 1 : 0;
    SUBJ.gate[i] = r(10) < 7 ? 1 : 0;
    SUBJ.acc[i] = SUBJ.gate[i] && r(10) < 3 ? 1 : 0;
    SUBJ.sld[i] = SUBJ.gate[i] && r(10) < 2 ? 1 : 0;
  }
  drawEditor(); draw(); if (playing) compile();
});

// RESET ALL — every part of it: transport, pending swap, phrase, genre, tempo,
// and the scroll positions, back to the state the page loads in.
document.getElementById("reset").addEventListener("click", () => {
  if (playing) stop();
  pending = null;
  SUBJ = structuredClone(DEFAULT);
  cur = DEFAULT_GENRE;
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  syncTabs(); drawEditor(); draw(); writeSrc();
  document.getElementById("dawscroll").scrollLeft = 0;
  document.querySelector(".steps").scrollLeft = 0;
});

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
drawEditor(); draw(); writeSrc();
