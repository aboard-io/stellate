// kernel-daw.js — the UI ONLY. The algebra is kernel.js, the genre table is
// genres.js; both load before this file (see kernel-daw.html).
//
// THE SONG IS THE SURFACE. Select a box, then click things on and off in it.
// Boxes drag to REORDER, and only to reorder — nothing is dragged into them.
// Click a box to play from there; double-click to loop it alone.
const { harm, render, drums, bass, ROMAN, word, drop, envelope,
        reverse, invert, rotate, fill, spread, KITOPS, split, del } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL } = window.NuGenres;

const DEFAULT_BPM = 126, NSLOTS = 8, NBOXES = 4;
const PX_PER_BAR = 22, BAR_PX = 26, MAX_LEN = 64, MAX_NUDGE = 31;

/* ---------- persistence ---------- */
// The song survives a reload; Reset all wipes it. Only plain data is stored —
// genre and transform names are STRING KEYS, never the operator functions — so
// the saved shape does not depend on the kernel's internals.
//
// The loader is deliberately paranoid. This shape has changed repeatedly (slots
// became an array, len/nudge replaced reps, mode and rate arrived), and a
// half-understood old save is worse than no save: it would restore a song that
// silently plays nothing. Anything that fails validation is dropped whole.
const STORE = "nukernel.song.v1";
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  writeStore();
}
function writeStore() {
  {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        v: 1, slots: SLOTS, song: SONG,
        bpm: +document.getElementById("bpm").value,
        vol: +document.getElementById("vol").value,
      }));
    } catch (e) { /* private mode, or quota: not worth interrupting the music */ }
  }
}
// Debounced during editing so a drag does not write on every frame — but
// FLUSHED when the page goes away, or an edit made in the last quarter second
// before a reload is simply lost.
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeStore, 250); }
addEventListener("pagehide", saveNow);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
const okPhrase = p => p && typeof p === "object" &&
  ["deg", "oct", "vel", "gate", "acc", "sld"].every(k =>
    Array.isArray(p[k]) && p[k].length === 16 && p[k].every(Number.isFinite));
const okBox = b => b && typeof b === "object" &&
  Array.isArray(b.stack) && b.stack.length &&
  b.stack.every(e => e && Object.prototype.hasOwnProperty.call(GENRES, e.g) &&
    Array.isArray(e.slots) && e.slots.every(i => Number.isInteger(i) && i >= 0 && i < NSLOTS) &&
    (e.ops == null || Array.isArray(e.ops)) &&
    (e.scale == null || Object.prototype.hasOwnProperty.call(SCALES, e.scale)) &&
    (e.artic == null || ["staccato", "normal", "legato", "tie"].includes(e.artic)) &&
    (e.cmode == null || ["hold", "loop", "reverse"].includes(e.cmode))) &&
  Number.isFinite(b.len) && Number.isFinite(b.nudge) &&
  Array.isArray(b.ops) &&
  (b.env === null || b.env === "in" || b.env === "out") &&
  (b.mode == null || Object.prototype.hasOwnProperty.call(MODES, b.mode)) &&
  (b.rate == null || Object.prototype.hasOwnProperty.call(RATES, b.rate)) &&
  (b.scale == null || Object.prototype.hasOwnProperty.call(SCALES, b.scale)) &&
  (b.cmode == null || ["hold", "loop", "reverse"].includes(b.cmode)) &&
  (b.artic == null || ["staccato", "normal", "legato", "tie"].includes(b.artic)) &&
  (b.kit == null || Object.prototype.hasOwnProperty.call(KITLABEL, b.kit)) &&
  (b.bassop == null || Object.prototype.hasOwnProperty.call(BASSOPS, b.bassop));
// One validate-and-apply path for BOTH sources. A file off the desktop gets
// exactly the same paranoia as a localStorage read — it is the same shape and
// can be just as stale, and hand-edited on top of that.
function applyState(raw) {
  if (!raw || raw.v !== 1) return false;
  if (!Array.isArray(raw.slots) || raw.slots.length !== NSLOTS || !raw.slots.every(okPhrase)) return false;
  // every older shape climbs to the current one: genre -> genres -> stack
  for (const b of raw.song || []) {
    if (!b) continue;
    if (!b.stack) {
      const gs = b.genres || (b.genre ? [b.genre] : ["simple"]);
      const sl = Array.isArray(b.slots) ? b.slots : [];
      b.stack = gs.map(g2 => ({ g: g2, slots: [...sl] }));   // they shared slots before
    }
  }
  if (!Array.isArray(raw.song) || !raw.song.length || !raw.song.every(okBox)) return false;
  // ops are FILTERED, not validated: the operator table changes as the palette
  // does, and a song should lose an obsolete chip rather than lose itself.
  for (const b of raw.song) {
    b.ops = (b.ops || []).filter(o => Object.prototype.hasOwnProperty.call(OPS, o));
    for (const e of b.stack) if (e.ops)
      e.ops = e.ops.filter(o => Object.prototype.hasOwnProperty.call(OPS, o));
  }
  for (const p2 of raw.slots) { if (!p2.inc) p2.inc = new Array(16).fill(0);
                                if (!p2.stk) p2.stk = new Array(16).fill(0); }
  SLOTS = raw.slots; SONG = raw.song; SUBJ = SLOTS[slot];
  if (Number.isFinite(raw.bpm) && raw.bpm >= 70 && raw.bpm <= 160) {
    document.getElementById("bpm").value = raw.bpm;
    document.getElementById("bpmv").textContent = String(raw.bpm);
  }
  if (Number.isFinite(raw.vol) && raw.vol >= 0 && raw.vol <= 100) {
    document.getElementById("vol").value = raw.vol;
    document.getElementById("volv").textContent = String(raw.vol);
  }
  return true;
}
function load() {
  try { return applyState(JSON.parse(localStorage.getItem(STORE) || "null")); }
  catch (e) { return false; }
}

// ---- desktop ----
function songJSON() {
  return JSON.stringify({ v: 1, slots: SLOTS, song: SONG,
    bpm: +document.getElementById("bpm").value,
    vol: +document.getElementById("vol").value }, null, 1);
}
function saveFile() {
  const names = [...new Set(SONG.flatMap(b => stackOf(b).map(e => e.g)))].join("-") || "song";
  const blob = new Blob([songJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "nukernel-" + names + "-" + SONG.length + "box.json";
  // the anchor must OUTLIVE the click: removing it in the same tick cancelled
  // the download in chromium and nothing was ever written
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function loadFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let raw = null;
    try { raw = JSON.parse(fr.result); } catch (e) { raw = null; }
    if (!applyState(raw)) {
      document.getElementById("readout").textContent =
        "that file is not a nukernel song, or it is from an incompatible version";
      return;
    }
    if (playing) stop();
    viewSec = 0; playingSec = -1; loopOnly = null; slot = 0; SUBJ = SLOTS[0];
    paletteBuilt = false;
    drawPalette(); drawSlots(); drawEditor(); drawSong(); draw(); save();
  };
  fr.readAsText(file);
}

/* ---------- phrases ---------- */
const z = () => new Array(16).fill(0);
const blank = () => ({ deg: z(), oct: z(), vel: new Array(16).fill(5),
                       inc: z(), stk: z(), gate: z(), acc: z(), sld: z() });
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
    p.inc[i] = r(12) === 0 ? (r(2) ? 1 : -1) : 0;   // a ramp on the odd step, not everywhere
  }
  return p;
}

/* ---------- song ---------- */
// A BOX is a genre, a SET of phrases, transforms, a length in bars and a nudge.
// LEN and NUDGE are a window onto the genre's own form: a fugue with len 2 and
// nudge 2 plays the last two bars of its four-bar form. The genre still renders
// its whole form — the box just decides which part of it you hear.
// Order matters and these do not commute: drop 2 then add 3 is not add 3 then
// drop 2. Chips apply in the order you switch them on.
// FOUR LIST FAMILIES, 1..4 each. repeat and delete change the SEQUENCE — repeat
// stretches every element, delete removes every nth and CLOSES the gap, which is
// the part `drop` never did — and raise/lower move it in scale degrees. Together
// with the inc/stk ramps this is the arpeggiator: restructure the list, then let
// it climb.
const OPS = { rev: reverse(), inv: invert(4), wide: spread(2), tight: spread(0.5) };
const OPLABEL = { rev: "reverse", inv: "invert",
                  wide: "spread \u00d72", tight: "spread \u00f72" };
for (let n = 2; n <= 8; n++) { OPS["rep" + n] = split(n); OPLABEL["rep" + n] = "split " + n; }
for (let n = 2; n <= 8; n++) { OPS["del" + n] = del(n);    OPLABEL["del" + n] = "delete " + n; }
// delete 1 would remove every element — the annihilator, not a variation.
const ENVLABEL = { in: "fade in", out: "fade out" };

const RATES = { half: 0.5, dbl: 2 };
const RATELABEL = { half: "half time", dbl: "double time" };
const KITLABEL = { nodrums: "no drums", shift: "shift kit",
                   halftime: "half-time kit", busy: "busy hats" };
const BASSOPS = { nobass: "no bass", walk: "walking", octaves: "octaves",
                  reese: "reese", wobble: "wobble" };
// A new box is SIMPLE — the phrase played as written. There is no empty state
// any more: a box always makes a sound as soon as it has a phrase, and the
// genres are legible as what they add to that.
// A BOX CARRIES A STACK OF GENRES, not one. The FIRST is the authority: it owns
// the harmony, the rate and the drums, and everything layered on top inherits
// them. That rule is the whole reason to stack rather than multitrack — two
// generators each writing their own progression is the mud, and a timeline of
// parallel lanes would let you avoid deciding rather than make you decide.
// Layers are lifted an octave so a fugue does not vanish under a guitar.
// Each entry in the stack carries ITS OWN phrases. Sharing one slot list across
// the stack meant a layered fugue could only ever restate whatever the rock riff
// was playing — which is not a counter-subject, it is a doubling. Rock on phrase
// 3 with a fugue on phrases 2+1 underneath is the whole point of layering.
const emptyBox = () => ({ stack: [{ g: "simple", slots: [] }], len: GENRES.simple.bars,
                          nudge: 0, ops: [], env: null, mode: null, rate: null, scale: null,
                          kit: null, bassop: null, clamp: null, cmode: null, artic: null });

// The genre a box actually renders with: its own definition, plus whatever the
// box overrides. Mode and tempo are not pattern operators and not envelopes —
// they are the third kind, a change to the GENRE the phrase is read through.
const genreOf = (sec, ent) => {
  const key = (ent && ent.g) || gid(sec);
  const g = GENRES[key];
  const scale = optOf(sec, ent, "scale"), artic = optOf(sec, ent, "artic");
  const clamp = optOf(sec, ent, "clamp"), cmode = optOf(sec, ent, "cmode");
  const out = { ...g, ...(sec.mode ? { mode: MODES[sec.mode] } : {}),
                ...(scale ? { scale: SCALES[scale] } : {}),
                ...(sec.rate ? { rate: g.rate * RATES[sec.rate] } : {}) };
  if (sec.kit) {
    out.kit = KITOPS[sec.kit](g.kit || {}); out.fill = null;
    if (sec.kit === "nodrums") out.ghost = null;   // the ghost lane is not in the kit
  }
  if (clamp != null) out.incClamp = +clamp;
  if (cmode) out.incMode = cmode;
  if (artic) out.artic = artic;
  if (sec.bassop === "nobass") out.nobass = true;
  else if (sec.bassop === "reese" || sec.bassop === "wobble") out.nobass = false;
  else if (sec.bassop) { out.nobass = false; out.bassStyle = sec.bassop; }
  return out;
};
let SONG = Array.from({ length: NBOXES }, emptyBox);
let viewSec = 0, playingSec = -1, loopOnly = null, dragFrom = null, pendingStart = null;

const curSection = () => SONG[Math.min(viewSec, SONG.length - 1)];
// WHICH OPTIONS BELONG TO A LAYER, and which to the box. The split is the same
// rule stacking was built on: the authority owns everything that must be shared
// for the box to be one piece of music — the grid, the groove, the key centre,
// the section envelope — and everything else is per layer.
//
//   per layer   pattern ops, split/delete, spread, articulation, ramp limit
//               and mode, subject scale
//   per box     tempo, drums, bass, chord mode, fade, length, nudge
//
// A layer field left unset INHERITS the box's, so nothing diverges by accident
// — which is how the fugue ended up reading pentatonic against a quartal riff.
const LAYER_OPTS = new Set(["op", "artic", "clamp", "cmode", "scale"]);
const optOf = (sec, ent, k) => (ent && ent[k] != null ? ent[k] : sec[k]);
const opsOf = (sec, ent) => (ent && ent.ops ? ent.ops : sec.ops);

const gid = sec => (sec.stack && sec.stack[0] && sec.stack[0].g) || null;
const stackOf = sec => sec.stack || [];
const focusOf = sec => Math.min(sec.focus || 0, stackOf(sec).length - 1);
const focused = sec => stackOf(sec)[focusOf(sec)] || { g: null, slots: [] };
const boxBars = b => (gid(b) ? b.len : 0);
const stackLabel = sec => stackOf(sec).map(e => GENRES[e.g].label).join(" + ");

/* ---------- what a box contributes ---------- */
// MULTIPLE PHRASES combine by being dealt across the genre's own voices: voice v
// plays phrase v % n. Two phrases in a four-voice fugue is a double fugue; two
// phrases in acid is two 303s running different patterns, which is what acid
// records actually did. The voice count never changes — the phrases share it.
function sectionEvents(sec) {
  if (!gid(sec)) return { g: null, bars: 0, ev: [] };
  const g = genreOf(sec);
  // NUDGE is an absolute bar offset, not a phase modulo the form. Nudging a
  // fugue past bar 4 starts it AFTER the exposition, which is a different piece
  // of music from nudging within the first four bars — so it must not wrap.
  const len = Math.max(1, sec.len || g.bars), nudge = Math.max(0, sec.nudge);
  const total = Math.ceil((nudge + len) / g.bars) * g.bars;
  const barSteps = 16 / g.rate, from = nudge * barSteps, to = (nudge + len) * barSteps;

  const phrasesFor = e => (e.slots.length ? e.slots : [null])
    .map(i => word(i == null ? blank() : SLOTS[i], opsOf(sec, e).map(o => OPS[o])));
  const phrases = phrasesFor(stackOf(sec)[0]);
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

  // LAYERS. Each extra genre contributes only its pitched voices, rendered
  // through the authority's harmony, rate and mode — its own kit, bass and
  // progression are dropped, because a box has one groove and one key. Voice
  // indices continue past the authority's so the lanes stay separate.
  let vBase = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const extra = ent.g, L = GENRES[extra], lPh = phrasesFor(ent), lnP = lPh.length;
    // The layer inherits EVERY section-level override, not some of them. The
    // section's `scale` is the subject's alphabet, and leaving it out let the
    // authority read quartal while the layer read pentatonic — two alphabets
    // sounding at once, which is what "out of tune" was. `mode` was inherited
    // and `scale` was not, which is exactly the kind of near-miss that reads as
    // a tuning problem rather than a missing line of code.
    // the layer's OWN scale / articulation / ramp limit, each falling back to
    // the box's; the authority still owns harmony, rate and the grid
    const lo = genreOf(sec, ent);
    const lg = { ...L, harmony: g.harmony, roots: g.roots, rate: g.rate,
                 mode: g.mode, scale: lo.scale, incClamp: lo.incClamp,
                 incMode: lo.incMode, artic: lo.artic, kit: {}, ghost: null,
                 nobass: true, reg: v => L.reg(v) + 1 };
    // the layer reads ITS OWN phrases, dealt across ITS voices
    lPh.forEach((ph, pi) => {
      const lev = render(ph, lg, total);
      for (let v = pi; v < L.voices; v += lnP) {
        let prev = null;
        for (const e of lev.filter(e => e.v === v)) {
          out.push({ ...e, kind: "line", prev, pad: L.realize(v) === "pad",
                     v: vBase + v, layer: extra });
          prev = e.n;
        }
      }
    });
    vBase += L.voices;
  }

  const win = out.filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  return { g, bars: len, ev: envelope(win, sec.env, len * barSteps), vBase };
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
  // hold the scroll across the rebuild: innerHTML = "" resets it to 0, which
  // yanked the view back to bar 1 on every single chip click
  const sc = document.getElementById("dawscroll");
  const keepX = sc ? sc.scrollLeft : 0, keepY = sc ? sc.scrollTop : 0;
  gridEl.innerHTML = ""; phEls = [];
  if (sc) requestAnimationFrame(() => { sc.scrollLeft = keepX; sc.scrollTop = keepY; });
  writeSrc(); drawPalette();
  if (!g) {
    document.getElementById("readout").textContent =
      "box " + (viewSec + 1) + " is empty — click a genre below to fill it";
    return;
  }
  const lanes = [];
  const aSlots = stackOf(sec)[0].slots, nP = Math.max(1, aSlots.length);
  for (let v = 0; v < g.voices; v++)
    lanes.push({ name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: (aSlots.length > 1 ? "phrase " + (aSlots[v % nP] + 1) + " · " : "") + (g.words[v] || ""),
      kind: "pitch", color: "var(--v" + v + ")",
      ev: ev.filter(e => e.kind === "line" && e.v === v) });
  let lv = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const L = GENRES[ent.g], lnP = Math.max(1, ent.slots.length);
    for (let v = 0; v < L.voices; v++)
      lanes.push({ name: L.label + " " + v,
        op: (ent.slots.length ? "phrase " + (ent.slots[v % lnP] + 1) + " · " : "") + (L.words[v] || ""),
        kind: "pitch", color: "var(--v" + ((v + 2) % 4) + ")",
        ev: ev.filter(e => e.kind === "line" && e.v === lv + v) });
    lv += L.voices;
  }
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
    t.textContent = "bar " + (sec.nudge + b + 1);
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
        ROMAN[harm(SLOTS[stackOf(sec)[0].slots[0]] || blank(), g, sec.nudge + b)]).join(" ") +
      (g.harmony === "emergent" ? " (computed)" : "");
  // Say WHY a box is silent rather than leaving it to be discovered by ear.
  const quiet = [];
  if (!ev.length) quiet.push("no events at all");
  else {
    if (!ev.some(e => e.kind === "line")) quiet.push(
      opsOf(sec, stackOf(sec)[0]).includes("drop1") ? "no melody (drop 1)"
        : !stackOf(sec).some(e => e.slots.length) ? "no melody (no phrase)" : "no melody");
    if (ev.every(e => (e.vel == null ? 5 : e.vel) === 0)) quiet.push("velocity 0 (a completed fade)");
  }
  document.getElementById("readout").textContent =
    "box " + (viewSec + 1) + " · " + stackLabel(sec) + " · " +
    stackOf(sec).map(e => GENRES[e.g].label + " " +
      (e.slots.length ? e.slots.map(i => i + 1).join("+") : "no phrase")).join(" | ") +
    " · " + bars + " bar" + (bars === 1 ? "" : "s") +
    (sec.nudge ? " nudged " + sec.nudge : "") + " · " + roots +
    (quiet.length ? "  —  " + quiet.join(", ") : "");
}

/* ---------- the sampled engine ---------- */
// THE SOUND COMES FROM THE PROJECT'S OWN SAMPLED LAYER, not from oscillators.
// engine/faust/voices/sampler.js is the same SamplerLive live.js drives, and the
// zones are the same FluidR3-class General MIDI extraction the big engine plays
// (found/samples/instruments/<dir>/<file>). We do NOT go through
// FaustLive.exploreLive: that takes a getState callback and calls
// E.buildEvents(state) itself, so it generates its own events from a
// genre-kernel state — there is no seam to hand it a nukernel event list. The
// voice layer underneath it has exactly the seam we need.
const SP = window.FaustSampler, REG = window.__REGISTRY;
const SAMPLERS = (REG && REG.SAMPLERS) || {};
const MEDIA = "../found/samples/instruments/";

// one instrument per genre, and one for the bass lane
const INSTR = { simple: "yamaha_grand_piano", fugue: "rock_organ", acid: "clean_guitar",
                vaporwave: "strings", blues: "steel_string_guitar", rock: "crunch_guitar" };
const BASS_INSTR = "acoustic_bass";

// THE DRUM KIT IS SAMPLED TOO. found/samples/drums/<kit>/ is the same
// extraction the big engine plays — real kick, snare, hats, clap — and it is
// what the hand-rolled sine-and-noise kit was standing in for. That stand-in is
// why a mix of piano and organ still sounded like boops: everything melodic was
// a real instrument and the drums were a pitch-dropped oscillator.
const DRUMDIR = "../found/samples/drums/";
const DRUMFILE = { k: "kick.wav", s: "snare.wav", h: "hatClosed.wav",
                   o: "hatOpen.wav", c: "clap.wav", p: "rim.wav" };
const drumBufs = new Map();                       // "kit|lane" -> AudioBuffer
// Assets currently being fetched. A note whose instrument is IN FLIGHT is
// dropped, not played on the fallback oscillator: a moment of silence while a
// guitar decodes is honest, a beep in its place is not.
const inFlight = new Set();
async function loadKit(kit) {
  inFlight.add("kit:" + kit);
  await Promise.all(Object.entries(DRUMFILE).map(async ([lane, file]) => {
    const key = kit + "|" + lane;
    if (drumBufs.has(key)) return;
    try {
      const r = await fetch(DRUMDIR + kit + "/" + file);
      if (!r.ok) throw new Error(String(r.status));
      drumBufs.set(key, await ctx.decodeAudioData(await r.arrayBuffer()));
    } catch (e) { drumBufs.set(key, null); }
  }));
  inFlight.delete("kit:" + kit);
}
function playDrum(kit, lane, when, acc, vel) {
  const buf = kit && drumBufs.get(kit + "|" + lane);
  if (!buf) return !!kit && inFlight.has("kit:" + kit);
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return false;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = (acc ? 1 : 0.72) * (0.45 + 0.55 * lvl) * (lane === "p" ? 0.5 : 1);
  src.connect(g); g.connect(bus);
  src.start(when);
  return true;
}

const zoneBufs = new Map();                       // "id|file" -> AudioBuffer
const specOf = id => {
  const S = SAMPLERS[id];
  if (!S) return null;
  return { sr: S.sr, dir: S.dir, zones: S.zones.map(z => ({
    file: z.file, root: z.root, lo: z.lo, hi: z.hi,
    loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: S.sr })) };
};
async function loadInstrument(id) {
  const spec = specOf(id);
  if (!spec) return false;
  inFlight.add("ins:" + id);
  await Promise.all(spec.zones.map(async z => {
    const key = id + "|" + z.file;
    if (zoneBufs.has(key)) return;
    try {
      const r = await fetch(MEDIA + spec.dir + "/" + z.file);
      if (!r.ok) throw new Error(r.status + " " + z.file);
      zoneBufs.set(key, await ctx.decodeAudioData(await r.arrayBuffer()));
    } catch (e) { zoneBufs.set(key, null); }
  }));
  inFlight.delete("ins:" + id);
  return true;
}
// every instrument the song needs, decoded before the transport starts
function instrumentsInSong() {
  const ids = new Set([BASS_INSTR]);
  for (const sec of SONG) for (const e of stackOf(sec)) ids.add(INSTR[e.g] || "yamaha_grand_piano");
  return [...ids];
}
let sampler = null;

/* ---------- the Faust synth voices ---------- */
// A genre carrying `synth` is never sampled: its identity IS the synthesis. The
// tb303 voice takes the phrase's vectors one for one — freq from deg+oct, gate
// from gate, accent from acc, slide from sld — which is not a coincidence, it is
// what a 303 sequencer always was.
//
// Every Faust param is a real AudioParam (measured: parameters.size 11,
// freq.setValueAtTime present), so notes are scheduled on the audio clock
// exactly like the sampler's, with no timer poking values from the main thread.
const FAUSTDIR = "../engine/faust/";
const synthNodes = new Map();
let dx7Presets = null;
async function loadSynth(spec) {
  if (synthNodes.has(spec.dsp)) return synthNodes.get(spec.dsp);
  try {
    const fw = await import(FAUSTDIR + "node_modules/@grame/faustwasm/dist/esm/index.js");
    const fac = await fw.FaustWasmInstantiator.loadDSPFactory(
      FAUSTDIR + "dist/" + spec.dsp + "-module.wasm",
      FAUSTDIR + "dist/" + spec.dsp + "-meta.json");
    const node = await new fw.FaustMonoDspGenerator().createNode(ctx, spec.dsp, fac);
    // A CARTRIDGE PATCH is 144 params set once. data/dx7-presets.json is the
    // real sysex decoded, so "E.PIANO 1" is the actual DX7 patch, not a
    // sound-alike — and its `alg` picks which dx7_algN module to load.
    if (spec.preset) {
      if (!dx7Presets) dx7Presets = await (await fetch(FAUSTDIR + "data/dx7-presets.json")).json();
      const pre = dx7Presets[spec.preset];
      if (pre) for (const [path, v] of Object.entries(pre.params)) {
        const a = node.parameters.get("/" + spec.root + path);
        if (a) a.setValueAtTime(v, ctx.currentTime);
      }
    }
    node.connect(bus);
    synthNodes.set(spec.dsp, node);
    return node;
  } catch (e) { synthNodes.set(spec.dsp, null); return null; }
}
// Every voice takes freq/gate/level the same way; the rest is per-DSP and is
// declared in the genre, so adding a synth is a data change rather than code.
function playSynth(spec, midi, when, durSec, acc, sld, vel) {
  const node = synthNodes.get(spec.dsp);
  if (!node) return false;
  const set = (n, v, t) => {
    const a = node.parameters.get("/" + spec.root + "/" + n);
    if (a && v != null) a.setValueAtTime(v, t);
  };
  for (const [k, v] of Object.entries(spec.set || {})) set(k, v, when);
  set("accent", acc ? 1 : 0, when);
  set("slide", sld ? 1 : 0, when);
  const lvl = spec.level * (0.25 + 0.75 * ((vel == null ? 5 : vel) / 9));
  set("level", lvl, when); set("gain", Math.min(1, lvl), when);
  // FOLD INTO THE VOICE'S RANGE. A Faust freq param has a declared min/max —
  // DX7 stops at 1000 Hz, bass_reese at 500 — and setting a value past it does
  // not error, it CLAMPS, so every note above the ceiling collapses onto the
  // same pitch. That is not "a bit high", it is out of tune. Fold by octaves,
  // which keeps the pitch class and only moves the register.
  const fa = node.parameters.get("/" + spec.root + "/freq");
  let f = hz(midi);
  if (fa) {
    while (f > fa.maxValue && f / 2 >= fa.minValue) f /= 2;
    while (f < fa.minValue && f * 2 <= fa.maxValue) f *= 2;
    f = Math.max(fa.minValue, Math.min(fa.maxValue, f));
  }
  set("freq", f, when);
  set("gate", 1, when);
  set("gate", 0, Math.max(when + 0.02, when + durSec * 0.92));
  return true;
}
// SYNTH BASSES, offered as bass transforms: a reese IS its detuned beating and
// a wobble IS its LFO, so neither can be a sample — the same law as the 303.
const BASSSYNTH = {
  reese:  { dsp: "bass_reese",  root: "bass_reese",  level: 0.8,
            set: { cutoff: 900, fenvAmount: 1.2, fenvAttack: 0.005, fenvDecay: 0.35 } },
  wobble: { dsp: "bass_wobble", root: "bass_wobble", level: 0.8,
            set: { cutoff: 1200, res: 0.38, wobbleHz: 3.2, fenvAmount: 1.5,
                   fenvAttack: 0.004, fenvDecay: 0.4 } },
};
function playSampled(id, midi, when, durSec, vel, gainMul) {
  const spec = specOf(id);
  if (!spec || !sampler) return false;
  const z = SP.zoneFor(spec.zones, midi);
  if (!z) return false;
  const buf = zoneBufs.get(id + "|" + z.file);
  if (!buf) return inFlight.has("ins:" + id);      // loading: drop it, do not beep
  const lead = SP.zoneLeadIn ? SP.zoneLeadIn(buf, z, buf.sampleRate, spec.sr) : 0;
  const leadSec = lead ? lead / (buf.sampleRate || spec.sr) : 0;
  sampler.note(buf, when, {
    rate: SP.rateFor(z, midi), durSec,
    gain: 0.42 * (0.2 + 0.8 * ((vel == null ? 5 : vel) / 9)) * (gainMul || 1),
    atk: 0.006, rel: 0.12, dry: 1, rsend: 0.14, dsend: 0,
    offsetSec: leadSec,
    loop: !!z.loop,
    loopStartSec: (z.loopStart || 0) / spec.sr + leadSec,
    loopEndSec: (z.loopEnd || 0) / spec.sr + leadSec });
  return true;
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
  bus = ctx.createGain(); bus.gain.value = masterVol();
  verb = ctx.createConvolver(); verbGain = ctx.createGain(); verbGain.gain.value = .2;
  const len = ctx.sampleRate * 2.6, ib = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ib;
  bus.connect(comp); bus.connect(verbGain); verbGain.connect(verb); verb.connect(comp);
  comp.connect(ctx.destination);
  if (SP && SP.SamplerLive) {
    try { sampler = SP.SamplerLive(ctx, { dry: bus, rev: verbGain, del: bus }); }
    catch (e) { sampler = null; }
  }
  const nl = ctx.sampleRate * .5; noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
}
const masterVol = () => (+document.getElementById("vol").value / 100) * 1.1;
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
    if (!gid(sec)) continue;
    const { g, bars, ev } = sectionEvents(sec);
    // A BOX THAT PRODUCES NOTHING TAKES NO TIME. Since Simple became the default
    // there is no "empty" box any more, so a fresh page was four boxes of which
    // three had no phrase — one bar of music followed by three bars of silence,
    // for ever. A box with no events is skipped the way an empty one used to be.
    if (!ev.length) continue;
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
    if (pendingStart != null) {                    // a queued jump lands on the bar
      const at2 = TL.findIndex(x => x.si === pendingStart && x.first);
      pendingStart = null;
      if (at2 >= 0) nextBar = at2;
      drawSong();
    }
    if (nextBar >= TL.length) nextBar = 0;
    const bar = TL[nextBar];
    if (bar.first) { passStart = nextBarTime; showSection(bar.si); }
    for (const e of bar.ev) {
      const when = nextBarTime + e.off * sd;
      if (e.kind === "line") {
        const owner = e.layer || gid(SONG[bar.si]);
        const gsyn = GENRES[owner].synth;
        const id = INSTR[owner] || "yamaha_grand_piano";
        const useSyn = gsyn && !(gsyn.lineOnly && e.pad);
        if (useSyn && playSynth(gsyn, e.n, when, e.dur * sd, e.acc, e.sld, e.vel)) { /* signature voice */ }
        else if (!playSampled(id, e.n, when, e.dur * sd, e.vel, 1))
          line(when, e.n, e.dur * sd, e.acc, e.sld, e.prev, bar.g.tone, e.pad, e.vel);
      } else if (e.kind === "hit") {
        const kit = GENRES[gid(SONG[bar.si])].drumkit;
        if (!playDrum(kit, e.d, when, e.acc, e.vel)) hit(when, e.d, e.acc, e.vel);
      }
      else if (e.kind === "bass") {
        const bs = BASSSYNTH[SONG[bar.si].bassop];
        if (bs && playSynth(bs, e.n, when, e.dur * sd, 0, 0, e.vel)) { /* synth bass */ }
        else if (!playSampled(BASS_INSTR, e.n, when, e.dur * sd, e.vel, 1.25))
          line(when, e.n, e.dur * sd, 1, 0, null,
            { wave: "square", cut: 340, q: 5, atk: .006, rel: .8, gain: .26 }, false, e.vel);
      }
    }
    nextBarTime += bar.barSteps * sd;
    nextBar = (nextBar + 1) % TL.length;
  }
}
function frame() {
  if (!playing) return;
  const sd0 = stepDur();
  const box = document.querySelectorAll(".box")[playingSec];
  if (box) {
    const g = GENRES[gid(SONG[playingSec])];
    const total = SONG[playingSec].len * 16 / g.rate * sd0;
    const f = Math.max(0, Math.min(1, (ctx.currentTime - passStart) / total));
    const bar2 = box.querySelector(".fillbar");
    if (bar2) bar2.style.width = (f * 100).toFixed(2) + "%";
  }
  document.querySelectorAll(".box").forEach((b2, i2) => {
    if (i2 !== playingSec) { const f2 = b2.querySelector(".fillbar"); if (f2) f2.style.width = "0%"; }
  });
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
// Everything the CURRENT song needs that is not already decoded. Called before
// the transport starts AND on every song change while it is running — a genre
// switched mid-play needs its guitar and its kit exactly as much as one chosen
// before pressing play, and only the first case used to fetch them.
async function ensureAssets(announce) {
  const need = instrumentsInSong().filter(id => {
    const sp = specOf(id); return sp && sp.zones.some(z => !zoneBufs.has(id + "|" + z.file));
  });
  const kits = [...new Set(SONG.filter(x => gid(x) && GENRES[gid(x)].drumkit)
                               .map(x => GENRES[gid(x)].drumkit))]
    .filter(k => !drumBufs.has(k + "|k"));
  const synths = [...new Set([
    ...SONG.flatMap(x => stackOf(x).filter(e => GENRES[e.g].synth).map(e => GENRES[e.g].synth)),
    ...SONG.filter(x => BASSSYNTH[x.bassop]).map(x => BASSSYNTH[x.bassop])])];
  const wantSynth = synths.filter(sp => !synthNodes.has(sp.dsp));
  if (!need.length && !wantSynth.length && !kits.length) return false;
  if (announce) document.getElementById("readout").textContent =
    "loading " + [...need, ...wantSynth.map(x => x.dsp), ...kits].join(", ") + "\u2026";
  await Promise.all([...need.map(loadInstrument), ...wantSynth.map(loadSynth),
                     ...kits.map(loadKit)]);
  return true;
}

async function startAt(boxIndex) {
  initAudio(); if (ctx.state === "suspended") ctx.resume();
  compile();
  if (await ensureAssets(true)) draw();
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
  playing = false; clearInterval(timer); playingSec = -1; pendingStart = null;
  document.getElementById("play").textContent = "▶ Play";
  for (const p of phEls) p.style.transform = "translateX(-3px)";
  document.querySelectorAll(".fillbar").forEach(f => { f.style.width = "0%"; });
  drawSong();
}

/* ---------- clicking things on and off in the selected box ---------- */
function toggle(kind, value) {
  const sec = curSection();
  if (kind === "genre") {
    const st = sec.stack, i = st.findIndex(e => e.g === value);
    const wasWholeForm = !sec.len || sec.len === GENRES[st[0].g].bars;
    if (i >= 0) {
      if (st.length === 1) return;                        // the last one cannot be removed
      st.splice(i, 1);
      sec.focus = Math.min(sec.focus || 0, st.length - 1);
    } else if (st.length === 1 && st[0].g === "simple") {
      st[0].g = value;           // Simple is the blank default: the first real
                                 // genre REPLACES it rather than stacking on it
    } else {
      // a new layer INHERITS the authority's phrases, so it sounds the moment
      // it is added; diverging from there is a click on the phrase rail. Empty
      // was defensible and silent, and silent-on-add reads as broken.
      st.push({ g: value, slots: [...st[0].slots] });
      sec.focus = st.length - 1;
    }
    if (wasWholeForm) sec.len = GENRES[st[0].g].bars;
    sec.nudge = Math.min(sec.nudge, 31);
  } else if (kind === "phrase") {
    const ent = focused(sec);                  // phrases land on the FOCUSED layer
    if (!ent.g) return;
    const i = ent.slots.indexOf(value);
    i < 0 ? ent.slots.push(value) : ent.slots.splice(i, 1);
  } else if (kind === "focus") {
    sec.focus = +value;                        // which layer the phrase rail edits
  } else if (kind === "op") {
    const ent = focused(sec);
    if (!ent.ops) ent.ops = [...(sec.ops || [])];       // first edit forks the box's
    const i = ent.ops.indexOf(value);
    i < 0 ? ent.ops.push(value) : ent.ops.splice(i, 1);
  } else if (kind === "env") sec.env = sec.env === value ? null : value;
  else if (kind === "mode") sec.mode = sec.mode === value ? null : value;
  else if (kind === "rate") sec.rate = sec.rate === value ? null : value;
  else if (kind === "scale") {
    const ent = focused(sec);
    ent.scale = optOf(sec, ent, "scale") === value ? null : value;
  }
  else if (kind === "kit") sec.kit = sec.kit === value ? null : value;
  else if (kind === "bassop") sec.bassop = sec.bassop === value ? null : value;
  else if (kind === "clamp") {
    const ent = focused(sec);
    ent.clamp = optOf(sec, ent, "clamp") === value ? null : value;
  }
  else if (kind === "cmode") {
    const ent = focused(sec);
    ent.cmode = optOf(sec, ent, "cmode") === value ? null : value;
  }
  else if (kind === "artic") {
    const ent = focused(sec);
    ent.artic = optOf(sec, ent, "artic") === value ? null : value;
  }
  songChanged();
}
function songChanged() {
  drawSong(); draw(); drawSlots(); save();
  if (playing) {
    compile();
    ensureAssets(false).then(ok => { if (ok) draw(); });   // fetch what the change needs
  }
}

/* ---------- the song row ---------- */
function drawSong() {
  const el = document.getElementById("song");
  const keep = el.scrollLeft;
  el.innerHTML = "";
  SONG.forEach((sec, i) => {
    const bars = boxBars(sec);
    const box = document.createElement("div");
    box.className = "box" + (gid(sec) ? " full" : " empty") +
      (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "") +
      (i === loopOnly ? " looped" : "") + (i === pendingStart ? " queued" : "");
    box.style.width = (gid(sec) ? Math.max(116, bars * PX_PER_BAR) : 116) + "px";
    box.draggable = true;
    box.setAttribute("aria-label", "box " + (i + 1) +
      (gid(sec) ? ", " + stackLabel(sec) + ", " + bars + " bars" : ", empty"));

    const head = document.createElement("div"); head.className = "bhead";
    head.innerHTML = "<b>" + (i + 1) + "</b><span>" + bars + " bar" + (bars === 1 ? "" : "s") +
      (sec.nudge ? " +" + sec.nudge : "") + "</span>" +
      (i === loopOnly ? '<span class="loopmark">loop</span>' : "");
    const x = document.createElement("button");
    x.type = "button"; x.className = "x"; x.textContent = "×";
    x.setAttribute("aria-label", "remove box " + (i + 1));
    x.addEventListener("click", ev => {
      ev.stopPropagation();
      SONG.splice(i, 1);
      if (!SONG.length) SONG.push(emptyBox());
      viewSec = Math.min(viewSec, SONG.length - 1);
      if (loopOnly != null) loopOnly = null;
      songChanged();
      if (playing) { compile(); nextBar = 0; }
    });
    head.append(x);
    box.append(head);

    const gl = document.createElement("div");
    gl.className = "bgenre" + (gid(sec) ? " has" : "");
    gl.textContent = stackLabel(sec);
    box.append(gl);

    // The box lists phrase NUMBERS. The contour picture belongs in the slot rail
    // where you are choosing a phrase; repeating it here made the row a wall of
    // little graphs you had to decode instead of a song you could read.
    const ph = document.createElement("div");
    ph.className = "bphrase" + (stackOf(sec).some(e => e.slots.length) ? " has" : "");
    ph.textContent = stackOf(sec).map(e =>
      e.slots.length ? e.slots.map(i => i + 1).join("+") : "\u2014").join("  /  ");
    box.append(ph);

    const prog = document.createElement("div"); prog.className = "bprog";
    prog.append(Object.assign(document.createElement("i"), { className: "fillbar" }));
    box.append(prog);

    const tags = document.createElement("div"); tags.className = "btags";
    const fe = i === viewSec ? focused(sec) : stackOf(sec)[0];
    for (const o of opsOf(sec, fe)) tags.append(Object.assign(document.createElement("span"),
      { className: "tag", textContent: OPLABEL[o] }));
    const fclamp = optOf(sec, fe, "clamp"), fcmode = optOf(sec, fe, "cmode"),
          fartic = optOf(sec, fe, "artic"), fscale = optOf(sec, fe, "scale");
    if (fclamp != null) tags.append(Object.assign(document.createElement("span"),
      { className: "tag clp", textContent: "limit " + (fclamp === "0" ? "off" : fclamp) }));
    if (fcmode) tags.append(Object.assign(document.createElement("span"),
      { className: "tag clp", textContent: fcmode }));
    if (fartic) tags.append(Object.assign(document.createElement("span"),
      { className: "tag art", textContent: fartic }));
    if (sec.kit) tags.append(Object.assign(document.createElement("span"),
      { className: "tag kit", textContent: KITLABEL[sec.kit] }));
    if (sec.bassop) tags.append(Object.assign(document.createElement("span"),
      { className: "tag bas", textContent: BASSOPS[sec.bassop] }));
    if (fscale) tags.append(Object.assign(document.createElement("span"),
      { className: "tag rng", textContent: SCALELABEL[fscale] }));
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
    // Selecting is immediate; the JUMP waits for the bar line, so clicking
    // around while it plays never chops a bar in half.
    box.addEventListener("click", e => {
      if (e.target.closest(".grip")) return;
      viewSec = i; loopOnly = null;
      if (playing) { pendingStart = i; drawSong(); draw(); drawSlots(); }
      else { drawSong(); draw(); drawSlots(); startAt(i); }
    });
    box.addEventListener("dblclick", e => {
      if (e.target.closest(".grip")) return;
      viewSec = i; loopOnly = i;
      drawSong(); draw(); drawSlots(); startAt(i);
    });

    if (sec.genre) {
      // LEFT grip nudges the window into the genre's form; RIGHT grip sets its
      // length. Trimming a clip from either end, which is the DAW gesture.
      box.append(makeGrip("l", e0 => {
        const n0 = sec.nudge;
        return dx => {
          const n = Math.max(0, Math.min(MAX_NUDGE, n0 + Math.round(dx / BAR_PX)));
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
  // COPY duplicates the selected box — everything, including its transforms and
  // its trim — which is how a song gets a repeated section without rebuilding it.
  const copy = document.createElement("button");
  copy.type = "button"; copy.className = "addbox copy";
  copy.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
    '<rect x="6.5" y="2.5" width="11" height="13" rx="1.5"></rect>' +
    '<path d="M13.5 17.5h-11v-13"></path></svg>';
  copy.title = "duplicate the selected box";
  copy.setAttribute("aria-label", "duplicate the selected box");
  copy.addEventListener("click", () => {
    const src = JSON.parse(JSON.stringify(curSection()));
    SONG.splice(viewSec + 1, 0, src);
    viewSec = viewSec + 1; songChanged();
    if (playing) { compile(); }
  });
  el.append(copy);

  const add = document.createElement("button");
  add.type = "button"; add.className = "addbox"; add.textContent = "+";
  add.title = "add an empty box";
  add.setAttribute("aria-label", "add a box");
  add.addEventListener("click", () => {
    SONG.push(emptyBox()); viewSec = SONG.length - 1; songChanged();
  });
  el.append(add);
  el.scrollLeft = keep;
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
// BUILT ONCE, then only its ON states change. Rebuilding it on every draw
// destroyed the button under the pointer mid-click, which lost focus and made
// the page jump — and it took the keyboard focus ring with it.
let paletteBuilt = false, paletteSig = "";
function drawPalette() {
  const el = document.getElementById("palette");
  const sec = curSection();
  // The layer picker only EXISTS when there is more than one layer, and its
  // chips are LABELLED with each layer's phrases — neither of which a
  // build-once palette can update. Rebuild on a signature of the stack, so it
  // still does not rebuild on an ordinary chip click, which is what kept the
  // button from vanishing under the pointer.
  const sig = stackOf(sec).map(e => e.g + ":" + e.slots.join(",")).join("|");
  if (paletteBuilt && sig !== paletteSig) paletteBuilt = false;
  if (paletteBuilt) {
    el.querySelectorAll(".pchip").forEach(b => {
      const kind = b.dataset.kind, v = b.dataset.value;
      const ent = LAYER_OPTS.has(kind) ? focused(sec) : null;
      const on = kind === "genre" ? stackOf(sec).some(e => e.g === v)
        : kind === "op" ? opsOf(sec, ent).includes(v)
        : kind === "env" ? sec.env === v
        : kind === "mode" ? sec.mode === v
        : kind === "rate" ? sec.rate === v
        : kind === "scale" ? optOf(sec, ent, "scale") === v
        : kind === "kit" ? sec.kit === v
        : kind === "bassop" ? sec.bassop === v
        : kind === "clamp" ? optOf(sec, ent, "clamp") === v
        : kind === "cmode" ? (optOf(sec, ent, "cmode") || "hold") === v
        : kind === "artic" ? (optOf(sec, ent, "artic") || "normal") === v
        : kind === "focus" ? String(focusOf(sec)) === v : false;
      b.classList.toggle("on", !!on);
      b.setAttribute("aria-pressed", String(!!on));
    });
    return;
  }
  el.innerHTML = "";
  const group = (title, items) => {
    const g = document.createElement("div"); g.className = "pgroup";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
    for (const [kind, value, label, on, cls] of items) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pchip " + (cls || "") + (on ? " on" : "");
      b.textContent = label; b.setAttribute("aria-pressed", String(!!on));
      b.dataset.kind = kind; b.dataset.value = String(value);
      b.addEventListener("click", () => toggle(kind, value));
      g.append(b);
    }
    el.append(g);
  };
  group("genre", Object.keys(GENRES).map(k =>
    ["genre", k, GENRES[k].label, stackOf(sec).some(e => e.g === k), "gen"]));
  if (stackOf(sec).length > 1)
    group("editing layer", stackOf(sec).map((e, i) =>
      ["focus", String(i), GENRES[e.g].label + (e.slots.length
        ? " \u00b7 " + e.slots.map(n => n + 1).join("+") : " \u00b7 \u2014"),
        focusOf(sec) === i, "foc"]));
  group("pattern \u00b7 layer", ["rev", "inv"].map(k => ["op", k, OPLABEL[k], sec.ops.includes(k), ""]));
  group("split \u00b7 layer", [2, 3, 4, 5, 6, 7, 8].map(n =>
    ["op", "rep" + n, String(n), sec.ops.includes("rep" + n), "lst"]));
  group("delete \u00b7 layer", [2, 3, 4, 5, 6, 7, 8].map(n =>
    ["op", "del" + n, String(n), sec.ops.includes("del" + n), "lst"]));
  group("ramp limit \u00b7 layer", ["0", "2", "4", "8"].map(v =>
    ["clamp", v, v === "0" ? "off" : v, sec.clamp === v, "clp"]));
  group("articulation \u00b7 layer", ["staccato", "normal", "legato", "tie"].map(v =>
    ["artic", v, v, (sec.artic || "normal") === v, "art"]));
  group("at the limit \u00b7 layer", [["cmode", "hold", "hold", (sec.cmode || "hold") === "hold", "clp"],
                         ["cmode", "loop", "loop", sec.cmode === "loop", "clp"],
                         ["cmode", "reverse", "reverse", sec.cmode === "reverse", "clp"]]);
  group("range \u00b7 layer", [
    ["op", "wide", OPLABEL.wide, sec.ops.includes("wide"), "rng"],
    ["op", "tight", OPLABEL.tight, sec.ops.includes("tight"), "rng"],
    ...Object.keys(SCALES).map(k => ["scale", k, SCALELABEL[k], sec.scale === k, "rng"])]);
  group("drums \u00b7 box", Object.keys(KITLABEL).map(k =>
    ["kit", k, KITLABEL[k], sec.kit === k, "kit"]));
  group("bass \u00b7 box", Object.keys(BASSOPS).map(k =>
    ["bassop", k, BASSOPS[k], sec.bassop === k, "bas"]));
  group("chord mode \u00b7 box", Object.keys(MODES).map(k =>
    ["mode", k, MODELABEL[k], sec.mode === k, "mode"]));
  group("tempo \u00b7 box", Object.keys(RATES).map(k =>
    ["rate", k, RATELABEL[k], sec.rate === k, "rate"]));
  group("envelope \u00b7 box", [["env", "in", "fade in", sec.env === "in", "env"],
                     ["env", "out", "fade out", sec.env === "out", "env"]]);
  paletteBuilt = true; paletteSig = sig;
}

/* ---------- phrase slots: click toggles into the box AND opens the editor --- */
function drawSlots() {
  const el = document.getElementById("slots"); el.innerHTML = "";
  const sec = curSection(), ent = focused(sec);
  SLOTS.forEach((p, i) => {
    const inBox = ent.slots.includes(i);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (i === slot ? " sel" : "") + (inBox ? " inbox" : "");
    b.setAttribute("aria-pressed", String(inBox));
    b.setAttribute("aria-label", "phrase " + (i + 1) + (isBlank(p) ? ", empty" : ", filled") +
      (inBox ? ", in " + (ent.g ? GENRES[ent.g].label : "box") : ""));
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
      toggle("phrase", i);              // toggle() calls songChanged(), which saves
      drawSlots(); drawEditor();
    });
    el.append(b);
  });
}

/* ---------- slot editor ---------- */
const ROWS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
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
        if (key === "inc" || key === "stk") b.classList.add("ramp");
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + " " + val);
      } else {
        b.className = "cell" + (val ? " on" : "");
        b.textContent = val ? "●" : "";
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + (val ? " on" : " off"));
      }
      b.addEventListener("click", ev => {
        if (num) SUBJ[key][i] = clamp(val + (ev.shiftKey ? -1 : 1), num);
        else SUBJ[key][i] = val ? 0 : 1;
        drawEditor(); drawSlots(); drawSong(); draw(); save(); if (playing) compile();
      });
      el.append(b);
    }
  }
}

/* ---------- what the selected box asks for ---------- */
function writeSrc() {
  const sec = curSection(), out = document.getElementById("src");
  if (!gid(sec)) { out.textContent = "(empty box)"; return; }
  const g = genreOf(sec);
  const kit = Object.keys(g.kit || {}).length
    ? Object.entries(g.kit).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  out.innerHTML =
    g.label.toUpperCase() + "\n\n" +
    "form       " + g.bars + " bars\n" +
    "window     " + sec.len + " bars from bar " + (sec.nudge + 1) + "\n" +
    "phrases    " + stackOf(sec).map(e => GENRES[e.g].label + ": " +
      (e.slots.length ? e.slots.map(i => i + 1).join(", ") : "none")).join("\n           ") + "\n" +
    "rate       " + g.rate + (sec.rate ? "  (" + RATELABEL[sec.rate] + ")" : "") +
      (g.swing ? "   swing " + g.swing.toFixed(2) : "") + "\n" +
    "scale      [" + (g.scale || [0, 3, 5, 7, 10]).join(" ") + "]  " +
      (sec.scale ? SCALELABEL[sec.scale] : GENRES[gid(sec)].scale ? "genre's own" : "minor pentatonic") +
      "  \u2014 " + (12 / (g.scale || [0, 3, 5, 7, 10]).length).toFixed(1) +
      " semitones per degree-step\n" +
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
  document.getElementById("bpmv").textContent = e.target.value; save();
});
document.getElementById("vol").addEventListener("input", e => {
  document.getElementById("volv").textContent = e.target.value;
  if (bus) bus.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
  save();
});
const putPhrase = make => () => {
  SLOTS[slot] = make(); SUBJ = SLOTS[slot];
  drawSlots(); drawEditor(); drawSong(); draw(); save(); if (playing) compile();
};
document.getElementById("seed").addEventListener("click", putPhrase(() => structuredClone(DEFAULT)));
document.getElementById("rnd").addEventListener("click", putPhrase(randomPhrase));
document.getElementById("clear").addEventListener("click", putPhrase(blank));
document.getElementById("savefile").addEventListener("click", saveFile);
document.getElementById("loadfile").addEventListener("click",
  () => document.getElementById("loadinput").click());
document.getElementById("loadinput").addEventListener("change", e => {
  if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
  e.target.value = "";                       // so the same file can be picked twice
});
document.getElementById("reset").addEventListener("click", () => {
  if (playing) stop();
  try { localStorage.removeItem(STORE); } catch (e) { /* nothing to clear */ }
  SLOTS = Array.from({ length: NSLOTS }, blank); slot = 0; SUBJ = SLOTS[0];
  SONG = Array.from({ length: NBOXES }, emptyBox);
  viewSec = 0; playingSec = -1; loopOnly = null;
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  const vol = document.getElementById("vol");
  vol.value = 80; document.getElementById("volv").textContent = "80";
  if (bus) bus.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
  drawSlots(); drawEditor(); drawSong(); draw();
  document.getElementById("dawscroll").scrollLeft = 0;
});
addEventListener("resize", () => draw());

load();
drawSlots(); drawEditor(); drawSong(); draw();
