// kernel-daw.js — the UI ONLY. The algebra is kernel.js, the genre table is
// genres.js; both load before this file (see kernel-daw.html).
//
// THE SONG IS THE SURFACE. Select a box, then click things on and off in it.
// Boxes drag to REORDER, and only to reorder — nothing is dragged into them.
// Click a box to play from there; double-click to loop it alone.
const { harm, render, drums, bass, ROMAN, word, drop, envelope,
        reverse, invert, rotate, fill, spread, KITOPS, split, del, edges, groove,
        transpose, complement, crossmap, excerpt, only } = window.NuKernel;
const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL } = window.NuGenres;
const { compose, ROLES } = window.NuCompose;

const DEFAULT_BPM = 126, NSLOTS = 8, NBOXES = 4;
const PX_PER_BAR = 22, BAR_PX = 26, MAX_LEN = 64, MAX_NUDGE = 31;
// past this a box stops growing and starts saying its length in words instead
const MAX_BOX_PX = 240;

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
const has = (o, k) => k == null || Object.prototype.hasOwnProperty.call(o, k);
const okVox = v => v == null || (typeof v === "object" &&
  Object.keys(v).every(k => VOX[k] && (v[k] == null || VOX[k].t[v[k]] != null)));
const okBox = b => b && typeof b === "object" &&
  Array.isArray(b.stack) && b.stack.length &&
  b.stack.every(e => e && Object.prototype.hasOwnProperty.call(GENRES, e.g) &&
    Array.isArray(e.slots) && e.slots.every(i => Number.isInteger(i) && i >= 0 && i < NSLOTS) &&
    (e.ops == null || Array.isArray(e.ops)) &&
    has(SCALES, e.scale) &&
    (e.artic == null || ["staccato", "normal", "legato", "tie"].includes(e.artic)) &&
    (e.oct == null || has(OCTAVES, String(e.oct))) && okVox(e.vox) &&
    (e.cmode == null || ["hold", "loop", "reverse"].includes(e.cmode))) &&
  Number.isFinite(b.len) && Number.isFinite(b.nudge) &&
  Array.isArray(b.ops) &&
  (b.env == null || has(ENVLABEL, b.env)) &&
  has(MODES, b.mode) && has(RATES, b.rate) && has(SCALES, b.scale) &&
  (b.cmode == null || ["hold", "loop", "reverse"].includes(b.cmode)) &&
  (b.artic == null || ["staccato", "normal", "legato", "tie"].includes(b.artic)) &&
  has(KITLABEL, b.kit) && has(DRUMKITS, b.drumkit) && has(BASSOPS, b.bassop) &&
  has(SWINGLABEL, b.swing) && has(GROOVELABEL, b.groove) && has(ROLES, b.role) &&
  // the mixer half — every one of these is optional, and absent means "as the
  // genre asks", so an older save is a valid new song with a default channel
  (b.fx == null || Array.isArray(b.fx)) &&
  has(SENDS, b.rev) && has(SENDS, b.del) && has(VERBS, b.verb) &&
  has(DTIMES, b.dtime) && has(LEVELS, b.lvl) && has(PANS, b.pan) &&
  has(MOTLABEL, b.mot) && has(INLABEL, b.intro) && has(OUTLABEL, b.outro) &&
  (b.oct == null || has(OCTAVES, String(b.oct))) && okVox(b.vox);
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
    b.fx = (b.fx || []).filter(k => FX[k]).slice(0, MAX_FX);
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
    dropChannels();                 // a new song is a new mix; keep no old ones
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
//
// THE REST OF THE ALGEBRA, which the palette had simply never offered. kernel.js
// exports eleven operator families and four of them were reachable; the missing
// ones are not exotic corners, they are the moves an acid line is MADE of — the
// rotate that walks the sequence past itself, the accent flip, the slide map,
// the loop-a-fragment. Every one is a call into an operator that already existed
// and is already gated by test/unit/nukernel.test.js.
for (let n = 1; n <= 7; n++) { OPS["rot" + n] = rotate(n); OPLABEL["rot" + n] = String(n); }
// ONE VECTOR AT A TIME — the `only` discipline, which is what keeps a subject
// recognizable while its rhythm or its pitches move underneath it. Rotating the
// gate alone re-times the phrase and keeps every note; rotating deg alone keeps
// the rhythm and re-pitches it. The pair is the whole idea of a variation, and
// neither was reachable from the UI.
for (const n of [2, 4, 8]) {
  OPS["gat" + n] = only("gate", rotate(n)); OPLABEL["gat" + n] = "rhythm " + n;
  OPS["pit" + n] = only("deg", rotate(n));  OPLABEL["pit" + n] = "pitch " + n;
}
for (const n of [2, 3, 4]) { OPS["thin" + n] = drop(n); OPLABEL["thin" + n] = String(n); }
for (const n of [2, 3, 4]) { OPS["dens" + n] = fill(n); OPLABEL["dens" + n] = String(n); }
for (const n of [-2, -1, 1, 2]) {
  const k = "tr" + (n < 0 ? "m" : "p") + Math.abs(n);
  OPS[k] = transpose(n); OPLABEL[k] = (n > 0 ? "+" : "−") + Math.abs(n);
}
for (const n of [4, 8]) { OPS["ex" + n] = excerpt(0, n); OPLABEL["ex" + n] = String(n); }
OPS.accflip  = complement("acc");       OPLABEL.accflip  = "flip accents";
OPS.gateflip = complement("gate");      OPLABEL.gateflip = "negative";
OPS.slides   = crossmap("acc", "sld");  OPLABEL.slides   = "accents slide";
OPS.stick    = crossmap("gate", "acc"); OPLABEL.stick    = "accent all";

// TRANSITIONS, in two families that are genuinely different types. LEVEL runs on
// the event stream (kernel.js `envelope`); MOTION is automation on the section's
// mixer channel, because a filter opening is a fact about the SOUND and there is
// no event to hang it on. Offering both under one heading is the point — from
// the outside they answer the same question, "how does this section arrive".
const ENVLABEL = { in: "fade in", out: "fade out", swell: "swell",
                   duck: "duck", drop: "drop", stutter: "stutter" };
const MOTLABEL = { open: "filter open", close: "filter close",
                   rise: "riser", pump: "pump" };
// INTRO / OUTRO — the two bars that are not like the others (kernel.js `edges`).
// These are the ones that actually announce a section, because they are the only
// transforms allowed to write events that were not there: a drum fill is a
// different bar, not a louder one.
const INLABEL  = { count: "count-in", hit: "downbeat", solo: "melody alone",
                   kit: "drums alone", swell: "swell in" };
const OUTLABEL = { fill: "drum fill", roll: "snare roll", crash: "crash",
                   break: "drum break", tail: "no drums", cut: "cut short" };

const RATES = { half: 0.5, dbl: 2 };
const RATELABEL = { half: "half time", dbl: "double time" };
// SWING bends the grid — every odd sixteenth arrives late by this fraction of a
// step. It was a genre constant (blues alone had it, at a triplet third); as a
// box control it is the difference between a pattern and a performance, and it
// belongs to the section rather than to the genre for the same reason tempo does.
const SWINGS = { straight: 0, light: 0.12, swing: 0.22, shuffle: 1 / 3, hard: 0.42 };
const SWINGLABEL = { straight: "straight", light: "light", swing: "swing",
                     shuffle: "shuffle", hard: "hard shuffle" };
// GROOVE is the other half, and it is not the same half. Swing moves the odd
// sixteenths and nothing else; a groove is a sixteen-slot fingerprint of BOTH
// timing and loudness — which steps lean late, which land hard — and it is what
// separates a drum machine from a drummer. `dub` is mined rather than written
// (engine/pipes.js ACCENT_PROFILES, off the MIDIMAN dub rip).
const GROOVELABEL = { backbeat: "backbeat", push: "pushed", laidback: "laid back",
                      funk: "funk", dub: "dub" };
// EVERY KIT OPERATOR kernel.js has, which is thirteen rather than four.
const KITLABEL = { nodrums: "none", nokick: "no kick", nohats: "no hats",
                   snareonly: "snare only", shift: "shift", halftime: "half time",
                   doubletime: "double time", busy: "busy hats", sparse: "sparse",
                   four: "four on the floor", offbeat: "offbeat hats",
                   swap: "swap kick/snare", roll: "roll" };
// WHICH SAMPLED KIT — found/samples/drums/<kit>/, the same extraction the big
// engine plays. A genre names one; a box may borrow another, which is the
// difference between playing a beat and playing it on somebody else's drums.
const DRUMKITS = { acoustic: "acoustic", brush: "brushes", electronic: "electronic",
                   jazz: "jazz", power: "power", room: "room" };
const BASSOPS = { nobass: "none", walk: "walking", octaves: "octaves",
                  fifths: "fifths", pedal: "pedal", eighths: "eighths",
                  sixteenths: "sixteenths", reese: "reese", wobble: "wobble" };

/* ---------- the effects a section can carry ---------- */
// THESE ARE THE BIG ENGINE'S OWN EFFECTS, not lookalikes. Each entry is exactly
// the {type, params} shape engine/faust/voices/state-engine.js `insertChain`
// normalizes and engine/faust/voices/sampler.js `buildInsertNodes` builds — the
// same function the main app's live ring path calls to put a chorus on a pad.
// nukernel already loads sampler.js for the sampled voices, so the whole insert
// library came along with it and was simply never called. The defaults below are
// the ones the module declares, chosen to be audible on one bar.
const FX = {
  chorus:   { label: "chorus",     params: { rate: 0.7, depth: 0.6, mix: 0.45 } },
  phaser:   { label: "phaser",     params: { rate: 0.35, depth: 0.8, mix: 0.7 } },
  flanger:  { label: "flanger",    params: { rate: 0.3, depth: 0.9, feedback: 0.6, mix: 0.6 } },
  tremolo:  { label: "tremolo",    params: { rate: 5, depth: 0.8, mix: 0.9 } },
  leslie:   { label: "leslie",     params: { speed: 0.7, depth: 0.85, mix: 0.6 } },
  wah:      { label: "auto-wah",   params: { base: 320, range: 2.2, sens: 0.7, q: 4, mix: 0.9 } },
  ringmod:  { label: "ring mod",   params: { freq: 180, mix: 0.4 } },
  sweep:    { label: "filter sweep", type: "filtersweep",
              params: { lo: 400, hi: 5200, res: 0.35, rateBars: 4 } },
  fenv:     { label: "squelch",    type: "fenv",
              params: { base: 380, amount: 2.4, sens: 0.7, res: 0.6, decay: 0.16, mix: 1 } },
  echo:     { label: "tape echo",  type: "delay",
              params: { timeBars: 0.1875, feedback: 0.4, tone: 2800, mix: 0.35 } },
  crunch:   { label: "crunch",     type: "higain",
              params: { drive: 0.6, stages: 2, gate: 0.2, low: 0.55, mid: 0.35,
                        high: 0.6, presence: 0.5, level: 0.55, mix: 0.9 } },
};
const MAX_FX = 3;                 // an insert chain, not a pedalboard floor
// the {type, params} list buildInsertNodes wants, from the box's chip keys
const fxChain = keys => (keys || []).filter(k => FX[k])
  .map(k => ({ type: FX[k].type || k, params: { ...FX[k].params } }));

// SENDS ARE DISCRETE, like everything else here. A chip is a decision; a slider
// is a fiddle, and the whole surface is chips on purpose.
const SENDS = { none: 0, touch: 0.12, some: 0.3, wet: 0.55, drown: 0.9 };
const SENDLABEL = { none: "dry", touch: "touch", some: "some", wet: "wet", drown: "drown" };
const VERBS = { room: "room", hall: "hall", plate: "plate" };
// echo time as a fraction of a bar — the subdivisions worth having
const DTIMES = { "16": 0.0625, "8": 0.125, "d8": 0.1875, "4": 0.25, "d4": 0.375, "2": 0.5 };
const DTLABEL = { "16": "1/16", "8": "1/8", d8: "dotted", "4": "1/4", d4: "dotted 1/4", "2": "1/2" };
const LEVELS = { hush: 0.4, back: 0.7, norm: 1, fwd: 1.35 };
const LEVELLABEL = { hush: "hush", back: "back", norm: "normal", fwd: "forward" };
const PANS = { l: -0.7, hl: -0.35, c: 0, hr: 0.35, r: 0.7 };
const PANLABEL = { l: "left", hl: "left-ish", c: "centre", hr: "right-ish", r: "right" };

/* ---------- what a voice can be told to do ---------- */
// THE SYNTH KNOBS, as chips. A signature synth is the one place where the sound
// IS the genre — acid's accent and slide are filter behaviour, which is why
// genres.js declares tb303 and refuses to sample it — and until now the filter
// was a constant baked into the genre. These five are the 303's actual front
// panel, and because they are written as a NORMALIZED position rather than a
// number in Hz, the same chips drive the Model D and the reese/wobble basses
// through their own differently-named params (see setVox).
const VOX = {
  cut:  { labels: { dark: "dark", warm: "warm", open: "open", bright: "bright", scream: "screaming" },
          t: { dark: 0.06, warm: 0.16, open: 0.34, bright: 0.6, scream: 0.9 }, log: true },
  res:  { labels: { soft: "soft", med: "medium", hot: "hot", edge: "on the edge" },
          t: { soft: 0.2, med: 0.5, hot: 0.75, edge: 0.95 } },
  emod: { labels: { none: "none", low: "low", mid: "mid", max: "max" },
          t: { none: 0.02, low: 0.3, mid: 0.6, max: 0.95 } },
  dec:  { labels: { snap: "snap", short: "short", long: "long", drone: "drone" },
          t: { snap: 0.04, short: 0.16, long: 0.45, drone: 0.9 } },
  wave: { labels: { saw: "saw", square: "square" }, t: { saw: 0, square: 1 } },
};
// The param a knob rides, per DSP naming. First name that EXISTS on the node
// wins, so one chip covers tb303 / modeld / bass_reese / bass_wobble without a
// per-synth table — and a DSP that has none of them (the DX7) is simply not
// touched rather than being fed a param it does not own.
const VOXPARAM = { cut: ["cutoff"], res: ["resonance", "res"],
                   emod: ["envmod", "envAmount", "fenvAmount"],
                   dec: ["decay", "envDecay", "fenvDecay"],
                   wave: ["waveform", "oscMix"] };
// REGISTER, per layer — the one voice transformation that works on a sampled
// instrument as well as a synth, because it moves the note and not the timbre.
const OCTAVES = { "-2": "−2", "-1": "−1", "0": "0", "1": "+1", "2": "+2" };
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
// A BOX IS ALSO A MIXER CHANNEL. `fx` is its insert chain, `rev`/`del` its two
// sends, `verb`/`dtime` which reverb and which echo subdivision it is sent TO,
// `lvl`/`pan` where it sits, `mot` its filter automation. All of it is the same
// per-section-strip idea the big engine's state-engine.js carries per VOICE —
// see the mixer section below, which builds the real thing out of the same
// engine/faust/voices/sampler.js code.
const emptyBox = () => ({ stack: [{ g: "simple", slots: [] }], len: GENRES.simple.bars,
                          nudge: 0, ops: [], env: null, mode: null, rate: null, scale: null,
                          kit: null, drumkit: null, bassop: null, clamp: null, cmode: null,
                          artic: null, fx: [], rev: null, del: null, verb: null,
                          dtime: null, lvl: null, pan: null, mot: null,
                          intro: null, outro: null, swing: null, groove: null,
                          role: null });

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
  if (sec.drumkit) out.drumkit = sec.drumkit;      // borrow another kit's SOUND
  if (sec.swing) out.swing = SWINGS[sec.swing];    // "straight" is 0, and means it
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
const LAYER_OPTS = new Set(["op", "artic", "clamp", "cmode", "scale", "oct", "vox"]);
const optOf = (sec, ent, k) => (ent && ent[k] != null ? ent[k] : sec[k]);
const opsOf = (sec, ent) => (ent && ent.ops ? ent.ops : sec.ops);
// the synth knobs are an OBJECT of independent settings, so they inherit
// knob-by-knob rather than whole: setting the filter on a layer must not throw
// away the resonance it was inheriting from the box.
const voxOf = (sec, ent, k) => (ent && ent.vox && ent.vox[k] != null
  ? ent.vox[k] : (sec.vox ? sec.vox[k] : null));
const voxAll = (sec, ent) => {
  const out = {};
  for (const k of Object.keys(VOX)) { const v = voxOf(sec, ent, k); if (v != null) out[k] = v; }
  return Object.keys(out).length ? out : null;
};
const octOf = (sec, ent) => +(optOf(sec, ent, "oct") || 0);

const gid = sec => (sec.stack && sec.stack[0] && sec.stack[0].g) || null;
// WHICH SAMPLED KIT a box actually plays. The genre names one, the box may
// borrow another — and a genre that names NONE can still be given drums (four
// on the floor under a fugue), in which case it needs a real kit rather than the
// oscillator fallback, so it gets the plain acoustic one. A box with no drum
// lanes at all still gets null, because loading six wavs for a kit that will
// never fire is a fetch for nothing.
const kitOf = sec => {
  if (!gid(sec)) return null;
  if (sec.drumkit) return sec.drumkit;
  const g = GENRES[gid(sec)];
  if (g.drumkit) return g.drumkit;
  const k = sec.kit && KITOPS[sec.kit] ? KITOPS[sec.kit](g.kit || {}) : (g.kit || {});
  return Object.keys(k).length || g.ghost ? "acoustic" : null;
};
const stackOf = sec => sec.stack || [];
const focusOf = sec => Math.min(sec.focus || 0, stackOf(sec).length - 1);
const focused = sec => stackOf(sec)[focusOf(sec)] || { g: null, slots: [] };
const boxBars = b => (gid(b) ? b.len : 0);
// HOW LONG A BOX ACTUALLY LASTS, in seconds at the current tempo: its bars, in
// this genre's own step units, at the current step duration. A half-time genre's
// bar is twice as long in seconds as a normal one's, which is exactly the fact
// the bar count alone cannot tell you.
const secsOf = b => {
  if (!gid(b)) return 0;
  const g = genreOf(b);
  return boxBars(b) * (16 / g.rate) * (60 / (+document.getElementById("bpm").value) / 4);
};
const mmss = t => Math.floor(t / 60) + ":" + String(Math.round(t % 60)).padStart(2, "0");
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
  const a0 = stackOf(sec)[0];
  const phrases = phrasesFor(a0);
  const nP = phrases.length, out = [];
  // REGISTER and the SYNTH KNOBS ride the events, not the genre. Both are
  // per-layer, and by the time the scheduler sees an event the only thing left
  // that says which layer it came from is the event itself — the authority's
  // notes carry no `layer` tag at all. Tagging here is what lets one box put a
  // dark 303 an octave down under a bright one on top.
  const aOct = 12 * octOf(sec, a0), aVox = voxAll(sec, a0);

  phrases.forEach((ph, pi) => {
    const pitched = render(ph, g, total);
    for (let v = pi; v < g.voices; v += nP) {
      let prev = null;
      for (const e of pitched.filter(e => e.v === v)) {
        out.push({ ...e, n: e.n + aOct, kind: "line", prev, lv: v,
                   vox: aVox, pad: g.realize(v) === "pad" });
        prev = e.n + aOct;
      }
    }
  });

  // Drums and bass follow the FIRST phrase — the kit is genre data anyway, and
  // the bass reads accents, which only one line can own.
  const lead = phrases[0];
  const dr = drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
  for (let r = 0; r < total / g.bars; r++)
    for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
  for (const e of bass(lead, g, total))
    out.push({ ...e, kind: "bass", vox: voxAll(sec, null) });

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
                 swing: g.swing, mode: g.mode, scale: lo.scale, incClamp: lo.incClamp,
                 incMode: lo.incMode, artic: lo.artic, kit: {}, ghost: null,
                 nobass: true, reg: v => L.reg(v) + 1 };
    // the layer reads ITS OWN phrases, dealt across ITS voices
    const lOct = 12 * octOf(sec, ent), lVox = voxAll(sec, ent);
    lPh.forEach((ph, pi) => {
      const lev = render(ph, lg, total);
      for (let v = pi; v < L.voices; v += lnP) {
        let prev = null;
        for (const e of lev.filter(e => e.v === v)) {
          out.push({ ...e, n: e.n + lOct, kind: "line", prev, vox: lVox, lv: v,
                     pad: L.realize(v) === "pad", v: vBase + v, layer: extra });
          prev = e.n + lOct;
        }
      }
    });
    vBase += L.voices;
  }

  const win = out.filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  // ORDER MATTERS, and this is the only order that makes sense. The envelope is
  // a curve over the whole section, so it must see the section as written; the
  // intro and outro REPLACE bars, so they must go last or the curve would fade
  // the fill it never knew about.
  const span = len * barSteps;
  // GROOVE LAST, so the drum fill grooves too. It is the only stage that moves
  // events in TIME rather than in pitch or level, and it has to see the final
  // stream — a fill written after the groove would be the one bar in the section
  // sitting flat on the grid, which is exactly what you notice.
  return { g, bars: len, vBase,
           ev: groove(edges(envelope(win, sec.env, span), sec.intro, sec.outro, span, barSteps),
                      sec.groove, barSteps, 1) };
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
const MEDIA = "../found/samples/";

// one instrument per genre, and one for the bass lane
// ONE INSTRUMENT PER GENRE, OR ONE PER VOICE. A string is the whole genre; an
// ARRAY is read per voice, with the last entry covering the rest. That second
// form is what a band is: the Isley Brothers are a Rhodes and a fuzz guitar at
// the same time, and until a genre could name two instruments the lead had to be
// played on the keyboard.
const INSTR = { simple: "yamaha_grand_piano", fugue: "rock_organ", acid: "clean_guitar",
                vaporwave: "strings", blues: "steel_string_guitar", rock: "crunch_guitar",
                newwave: ["clean_guitar", "synth_strings_1"],
                // the choral four all want a real recorded voice, and the
                // extraction has two of them — aahs for the sustained music,
                // oohs for the closer, brighter Bulgarian sound
                gregorian: "ahh_choir", spem: "ahh_choir", bulgarian: "ohh_voices",
                counterpoint: "harpsichord", neoclassical: "felt_piano",
                drone: "slow_strings", sludge: "overdrive_guitar",
                tango: ["bandoneon", "violin", "bandoneon"],
                deathmetal: "distortion_guitar",
                eurythmics: "synth_strings_1",
                isley: ["rhodes_ep", "overdrive_guitar", "rhodes_ep"],
                toto: ["synth_strings_1", "marimba", "clean_guitar"],
                jodeci: ["ahh_choir", "rhodes_ep"],
                beatles: ["steel_string_guitar", "ohh_voices"],
                steely: ["rhodes_ep", "jazz_guitar", "rhodes_ep"],
                postrock: ["slow_strings", "clean_guitar", "clean_guitar"] };
const instrOf = (g, v) => {
  const e = INSTR[g];
  if (Array.isArray(e)) return e[Math.min(v || 0, e.length - 1)] || e[0];
  return e || "yamaha_grand_piano";
};
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
function playDrum(kit, lane, when, acc, vel, chan) {
  const buf = kit && drumBufs.get(kit + "|" + lane);
  if (!buf) return !!kit && inFlight.has("kit:" + kit);
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return false;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = (acc ? 1 : 0.72) * (0.45 + 0.55 * lvl) * (lane === "p" ? 0.5 : 1);
  src.connect(g); g.connect((chan && chan.drumIn) || bus);
  src.start(when);
  return true;
}

// ---- FONTS, the main app's own logic ----
// engine/faust/data/fonts.json lists fourteen. Eleven are SOUNDFONTS: a
// font-<key>.json carries its own zones per instrument under its own media base
// (found/samples/instruments-<key>/), and an instrument the font does not cover
// falls back to the default. Two are SYNTH fonts — Pure FM and Pure Analog — and
// they are not a different set of samples at all: they flip every pitched voice
// onto a Faust synth and the sampler stops being used.
const FONTS = [
  { key: "fluidr3", label: "Sampled", kind: "sample" },
  { key: "sgm", label: "SGM Pro" }, { key: "windows", label: "Seattle Glass" },
  { key: "montego", label: "Terrapin" }, { key: "sc55", label: "Oliphant" },
  { key: "gravis", label: "Gravitas" }, { key: "gba", label: "Pocket Lad" },
  { key: "emu_aps", label: "Rossum" }, { key: "diet_candy", label: "Diet Candy" },
  { key: "blackberry", label: "Thumbfruit" }, { key: "8bit", label: "8-bit" },
  { key: "dx7", label: "Pure FM", kind: "synth",
    synth: { dsp: "dx7_alg5", root: "DX7", preset: "E.PIANO 1", level: 0.9 } },
  { key: "analog", label: "Pure Analog", kind: "synth",
    synth: { dsp: "modeld", root: "modeld", level: 0.8,
             set: { cutoff: 2400, res: 0.28, envAmount: 1.6, envAttack: 0.006,
                    envDecay: 0.5, envSustain: 0.4, oscMix: 0.4, drive: 0.3,
                    glide: 0, drift: 6 } } },
];
let FONT = "fluidr3";
const fontDef = () => FONTS.find(f => f.key === FONT) || FONTS[0];
const isSynthFont = () => fontDef().kind === "synth";
const fontData = new Map();                       // key -> font-<key>.json
async function loadFont(key) {
  // a SYNTH font has no zone file to fetch — it is a voice, not a sample set
  const def = FONTS.find(f => f.key === key);
  if (key === "fluidr3" || (def && def.kind === "synth") || fontData.has(key)) return;
  try {
    const r = await fetch(FAUSTDIR + "data/font-" + key + ".json");
    fontData.set(key, r.ok ? await r.json() : null);
  } catch (e) { fontData.set(key, null); }
}

const zoneBufs = new Map();                       // "id|file" -> AudioBuffer
const specOf = id => {
  // per-INSTRUMENT fallback, exactly as the main app does it: a font that does
  // not carry this instrument serves the default one rather than going silent
  const F = fontData.get(FONT);
  if (F && F.instr && F.instr[id]) {
    return { sr: F.instr[id].sr, dir: id, base: F.base,
      zones: F.instr[id].zones.map(z => ({ file: z.file, root: z.root, lo: z.lo,
        hi: z.hi, loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, sr: F.instr[id].sr })) };
  }
  const S = SAMPLERS[id];
  if (!S) return null;
  return { sr: S.sr, dir: S.dir, base: "instruments", zones: S.zones.map(z => ({
    file: z.file, root: z.root, lo: z.lo, hi: z.hi,
    loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: S.sr })) };
};
async function loadInstrument(id) {
  const spec = specOf(id);
  if (!spec) return false;
  inFlight.add("ins:" + id);
  await Promise.all(spec.zones.map(async z => {
    const key = FONT + "|" + id + "|" + z.file;
    if (zoneBufs.has(key)) return;
    try {
      const r = await fetch(MEDIA + (spec.base || "instruments") + "/" + spec.dir + "/" + z.file);
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
  for (const sec of SONG)
    for (const e of stackOf(sec)) {
      const n = GENRES[e.g] ? GENRES[e.g].voices : 1;
      for (let v = 0; v < n; v++) ids.add(instrOf(e.g, v));
    }
  return [...ids];
}

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
// ONE NODE PER VOICE. A Faust mono DSP is exactly that — mono — so a four-voice
// fugue routed through a single dx7 kept only the last note written to /DX7/freq
// and the counterpoint collapsed to one line. The pool is keyed by dsp AND voice
// index, which is how a monophonic voice becomes polyphonic: by there being
// several of it, the way a real DX7 has sixteen.
// ONE NODE PER VOICE, AND THAT IS ALL. A Faust worklet is not free when it is
// idle — it computes every 128-sample block whether or not a note is sounding —
// so the pool size is a CPU budget, not a memory one.
//
// Keying it by CHANNEL as well, which is what a section's own effects seem to
// ask for, multiplies that budget by the number of distinct mixes in the song.
// Measured on a composed vaporwave track: nine sections, six distinct channels,
// each wanting a two-voice DX7 plus whichever synth bass its drop asked for —
// thirty-six always-on FM operators' worth of worklet, plus thirty-six wasm
// compiles at load. That is the glitching, and it is not subtle.
//
// So the pool stays global and the ROUTE moves instead: every node fans out to
// every channel through a gain, and exactly one of those gains is open. The
// section still gets its own inserts and its own sends — the signal really does
// go through them — but the expensive thing exists once.
const synthKey = (spec, v) => spec.dsp + "#" + v;
const synthOut = new Map();                       // nodeKey -> Map(chanKey -> gain)
function routeSynth(key, node, chan) {
  if (!node || !chan) return null;
  let m = synthOut.get(key);
  if (!m) { m = new Map(); synthOut.set(key, m); }
  let g = m.get(chan.key);
  if (!g) {
    g = ctx.createGain(); g.gain.value = 0;
    node.connect(g); g.connect(chan.input); m.set(chan.key, g);
  }
  return g;
}
// Opened on the bar a section starts, with a 4 ms ramp — long enough not to
// click, short enough that the first note of the section is not clipped.
function focusSynths(chan, when) {
  if (!chan) return;
  for (const [key, m] of synthOut) {
    const node = synthNodes.get(key);
    if (node && !m.has(chan.key)) routeSynth(key, node, chan);
    for (const [k, g] of m)
      try { g.gain.setTargetAtTime(k === chan.key ? 1 : 0, when, 0.004); } catch (e) {}
  }
}
async function loadSynth(spec, v, chan) {
  const key = synthKey(spec, v);
  if (synthNodes.has(key)) { routeSynth(key, synthNodes.get(key), chan); return synthNodes.get(key); }
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
    synthNodes.set(key, node);
    // the node never touches a channel directly — it fans out through the
    // per-channel gates above, which is what keeps one node serving nine sections
    if (chan) routeSynth(key, node, chan); else node.connect(bus);
    return node;
  } catch (e) { synthNodes.set(key, null); return null; }
}
// THE VOICE KNOBS, applied generically. A chip carries a NORMALIZED position, not
// a number in Hz, so the same "bright" means bright on a 303 (cutoff 60..6000),
// on a Model D (60..16000) and on a reese (60..6000) without a per-synth table —
// and because the value is derived from the param's OWN declared range it can
// never land on a boundary, which is the clamp the audio gate exists to catch.
// (cutoff is heard in octaves, so it is interpolated in octaves — `log` below;
// the first param name the DSP actually owns wins, and a DSP that owns none of
// them, like the DX7, is simply left alone.)
// Every voice takes freq/gate/level the same way; the rest is per-DSP and is
// declared in the genre, so adding a synth is a data change rather than code.
function playSynth(spec, midi, when, durSec, acc, sld, vel, v, chan, vox) {
  const key = synthKey(spec, v || 0), node = synthNodes.get(key);
  if (!node) return false;
  routeSynth(key, node, chan);
  const set = (n, v, t) => {
    const a = node.parameters.get("/" + spec.root + "/" + n);
    if (a && v != null) a.setValueAtTime(v, t);
  };
  for (const [k, v] of Object.entries(spec.set || {})) set(k, v, when);
  // the section's own knobs, AFTER the genre's — that is what makes them an
  // override rather than a suggestion
  if (vox) for (const [k, val] of Object.entries(vox)) {
    const def = VOX[k]; if (!def || def.t[val] == null) continue;
    for (const name of (VOXPARAM[k] || [])) {
      const a = node.parameters.get("/" + spec.root + "/" + name);
      if (!a) continue;
      const t = def.t[val], lo = a.minValue, hi = a.maxValue;
      const nv = def.log && lo > 0 ? lo * Math.pow(hi / lo, t) : lo + t * (hi - lo);
      set(name, Math.max(lo, Math.min(hi, nv)), when);
      break;
    }
  }
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
const zoneSpan = new Map();
function foldToZones(zones, midi) {
  let sp = zoneSpan.get(zones);
  if (!sp) {
    sp = { lo: Infinity, hi: -Infinity };
    for (const z of zones) { if (z.lo < sp.lo) sp.lo = z.lo; if (z.hi > sp.hi) sp.hi = z.hi; }
    zoneSpan.set(zones, sp);
  }
  if (!(sp.hi >= sp.lo)) return midi;
  let m = midi;
  while (m < sp.lo && m + 12 <= sp.hi) m += 12;
  while (m > sp.hi && m - 12 >= sp.lo) m -= 12;
  return Math.max(sp.lo, Math.min(sp.hi, m));
}
function playSampled(id, midi, when, durSec, vel, gainMul, chan, strip) {
  const spec = specOf(id);
  const player = chan && chan.player;
  if (!spec || !player) return false;
  // FOLD INTO THE INSTRUMENT'S RANGE, the same law playSynth applies to a Faust
  // freq param and for the same reason. A sampler's zones cover a finite span,
  // and now that a layer can be moved two octaves either way a note can land
  // outside it — where zoneFor returns null, playSampled returns false, and the
  // note comes out of the oscillator fallback. Folding by octaves keeps the
  // pitch class and only moves the register.
  const midi2 = foldToZones(spec.zones, midi);
  const z = SP.zoneFor(spec.zones, midi2);
  if (!z) return false;
  const buf = zoneBufs.get(FONT + "|" + id + "|" + z.file);
  if (!buf) return inFlight.has("ins:" + id);      // loading: drop it, do not beep
  const lead = SP.zoneLeadIn ? SP.zoneLeadIn(buf, z, buf.sampleRate, spec.sr) : 0;
  const leadSec = lead ? lead / (buf.sampleRate || spec.sr) : 0;
  player.note(buf, when, {
    rate: SP.rateFor(z, midi2), durSec,
    gain: 0.42 * (0.2 + 0.8 * ((vel == null ? 5 : vel) / 9)) * (gainMul || 1),
    // THE STRIP IS WHERE THE MIX HAPPENS. sampler.js builds it — the same node
    // chain the big engine's live path builds from the same spec.
    strip,
    // the sends are the SECTION's, not the note's: every tap goes to the channel
    // input and the channel decides how wet the whole box is
    atk: 0.006, rel: 0.12, dry: 1, rsend: 0, dsend: 0,
    offsetSec: leadSec,
    loop: !!z.loop,
    loopStartSec: (z.loopStart || 0) / spec.sr + leadSec,
    loopEndSec: (z.loopEnd || 0) / spec.sr + leadSec });
  return true;
}

/* ---------- audio: THE MIX ---------- */
// THE MIXING IS THE BIG ENGINE'S MIXING, and none of the three pieces below is
// a reimplementation of it — each one is a call into the code that already ships:
//
//   channel strips  STRIP_PROFILES, lifted from engine/faust/voices/state-engine.js
//                   and handed to SamplerLive as `strip`. sampler.js then builds
//                   the real chain (HPF/LPF/EQ -> saturation -> compressor ->
//                   chorus/phaser), which is why a bass now sits under a lead
//                   instead of beside it.
//   inserts         SP.buildInsertNodes — literally the function live.js calls to
//                   put a phaser on a pad. Per SECTION here rather than per voice.
//   the master bus  live.js's own chain, numbers and all: glue compressor ->
//                   makeup -> brickwall limiter -> a ceiling lowpass. The comment
//                   there explains why it exists, and it applies word for word
//                   here: without it the sampled voices are unmastered and play
//                   at about -22 dBFS, which is the "why is this so quiet and
//                   so flat" that started this.
//
// What is NOT borrowed is the topology: the big engine mixes per VOICE because a
// genre is one continuous thing. A song box is a SECTION, and a section is the
// unit you want to reverb, echo, filter and place — so the channel is per box.
const STRIPS = {
  // BASS — kill subsonics, roll the top off, low-mid warmth, slow glue comp.
  bass: { hpf: 30, lpf: 5200, eq: { f: 110, gain: 2.5, q: 0.9 }, sat: 0.34, satMix: 0.42,
          comp: { thresh: 0.22, ratio: 3, atk: 0.02, rel: 0.18, makeup: 1.05 }, trim: 0.98 },
  // PAD — declutter the lows, scoop a little mud, wide ensemble chorus + a slow
  //   shallow phaser. The widest air: pads carry the space.
  pad: { hpf: 120, eq: { f: 300, gain: -1.5, q: 0.8 }, sat: 0.17, satMix: 0.3,
         comp: { thresh: 0.3, ratio: 2, atk: 0.03, rel: 0.28, makeup: 1.02 },
         chorus: { rate: 0.45, baseMs: 14, depthMs: 6, mix: 0.32 },
         phase: { rate: 0.22, lo: 300, hi: 1600, stages: 4, mix: 0.18 }, trim: 0.9 },
  // LEAD — clear the rumble, presence lift at 3 kHz, a touch of grit, fast comp.
  lead: { hpf: 200, eq: { f: 3000, gain: 3, q: 0.8 }, sat: 0.3, satMix: 0.44,
          comp: { thresh: 0.25, ratio: 3, atk: 0.008, rel: 0.12, makeup: 1.04 },
          chorus: { rate: 0.8, baseMs: 11, depthMs: 4, mix: 0.18 }, trim: 0.95 },
};
// DRUMS get a strip too, but a transient-preserving one — a subsonic HPF and a
// whisper of glue saturation, NO compressor and no dulling filter. It is one
// long-lived pair of nodes per channel rather than per note: the drums are
// buffers fired straight at it, not sampler notes.
const DRUM_HPF = 28, DRUM_SAT = 0.15, DRUM_SATMIX = 0.22;

let ctx = null, masterIn = null, bus = null, outGain = null, topLP = null, noise = null;
let REV = null, delA = null, delB = null, delLP = null, delBus = null;
let playing = false, timer = null;
let nextBarTime = 0, nextBar = 0, passStart = 0;

// a decaying-noise impulse response — three of them, because "which reverb" is
// a different question from "how much", and a plate is not a small hall
function impulse(sec, decay, damp) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      lp += (n - lp) * damp;                       // damping = the room's absorption
      d[i] = lp;
    }
  }
  return b;
}
function satCurve(G, mix) {
  const N = 1024, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, s = Math.tanh(x * G) / G; c[i] = x + mix * (s - x); }
  return c;
}

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterIn = ctx.createGain();
  bus = masterIn;                                  // where anything unrouted lands
  // ---- the master chain, live.js's numbers ----
  const busComp = ctx.createDynamicsCompressor();
  busComp.threshold.value = -22; busComp.knee.value = 28; busComp.ratio.value = 2.2;
  busComp.attack.value = 0.015; busComp.release.value = 0.25;
  const makeup = ctx.createGain(); makeup.gain.value = 2.2;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  topLP = ctx.createBiquadFilter(); topLP.type = "lowpass";
  topLP.frequency.value = 16000; topLP.Q.value = 0.5;
  outGain = ctx.createGain(); outGain.gain.value = masterVol();
  masterIn.connect(busComp); busComp.connect(makeup); makeup.connect(limiter);
  limiter.connect(topLP); topLP.connect(outGain); outGain.connect(ctx.destination);
  // ---- three reverbs, BUILT ON FIRST USE ----
  // A ConvolverNode with a 3.2-second stereo impulse is the most expensive
  // single node on the page, and it costs that whether or not anything is being
  // sent to it. Most songs use one of these; building all three at boot was
  // paying for a hall and a plate to render silence.
  REV = {};
  // ---- one PING-PONG echo bus. Cross-fed delays panned hard, so a section sent
  // to the echo throws its repeats across the stereo field instead of thickening
  // the middle — which is the whole reason to have a send rather than an insert.
  delBus = ctx.createGain();
  delA = ctx.createDelay(2.0); delB = ctx.createDelay(2.0);
  delLP = ctx.createBiquadFilter(); delLP.type = "lowpass"; delLP.frequency.value = 2800;
  const fbA = ctx.createGain(), fbB = ctx.createGain();
  fbA.gain.value = fbB.gain.value = 0.42;
  const panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner();
  panL.pan.value = -0.75; panR.pan.value = 0.75;
  delBus.connect(delA);
  delA.connect(delLP); delLP.connect(fbA); fbA.connect(delB);
  delB.connect(fbB); fbB.connect(delA);
  delA.connect(panL); delB.connect(panR);
  panL.connect(masterIn); panR.connect(masterIn);
  setDelayTime(0.1875);
  const nl = ctx.sampleRate * .5; noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
}
const VERBSPEC = { room:  [1.1, 3.4, 0.42, 220, 1.0],
                   hall:  [3.2, 2.0, 0.30, 180, 0.9],
                   plate: [1.9, 2.4, 0.85, 320, 0.85] };
function verbFor(name) {
  const n = VERBSPEC[name] ? name : "room";
  if (REV[n]) return REV[n];
  const [irSec, decay, damp, hp, ret] = VERBSPEC[n];
  const inp = ctx.createGain();
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; f.Q.value = 0.7;
  const cv = ctx.createConvolver(); cv.buffer = impulse(irSec, decay, damp);
  const g = ctx.createGain(); g.gain.value = ret;
  inp.connect(f); f.connect(cv); cv.connect(g); g.connect(masterIn);
  REV[n] = inp;
  return inp;
}
const barSec = () => 4 * 60 / (+document.getElementById("bpm").value);
function setDelayTime(bars) {
  if (!delA) return;
  const t = Math.min(1.9, Math.max(0.02, bars * barSec()));
  // eased, not jumped: a feedback delay whose time moves is a tape machine
  // changing speed, and that is a nicer thing to hear than a click
  try { delA.delayTime.setTargetAtTime(t, ctx.currentTime, 0.05);
        delB.delayTime.setTargetAtTime(t, ctx.currentTime, 0.05); } catch (e) {}
}

/* ---------- a section's mixer channel ---------- */
// KEYED BY WHAT IT IS, NOT BY WHICH BOX IT IS. Two boxes asking for the same
// chain get the same channel, which is both correct (they sound the same) and
// what keeps a long song from building forty insert chains. It also means a box
// that is dragged, copied or deleted needs no channel bookkeeping at all.
const CHAN = new Map();
const sendOf = (sec, k, dflt) => (sec[k] != null ? SENDS[sec[k]] : dflt);
function chanSpec(sec) {
  const g = GENRES[gid(sec)] || GENRES.simple;
  return {
    fx: (sec.fx || []).filter(k => FX[k]).slice(0, MAX_FX),
    // ABSENT MEANS "AS THE GENRE ASKS". Every genre already declares how wet it
    // wants to be (tone.verb — vaporwave .55, acid .06), and that number was
    // being thrown away: every voice went out on a flat 0.14 send. Reading it as
    // the default send makes the genre table mean what it says.
    rev: sendOf(sec, "rev", g.tone && g.tone.verb != null ? g.tone.verb : 0.15),
    del: sendOf(sec, "del", 0),
    verb: sec.verb || (g.tone && g.tone.verb > 0.4 ? "hall" : "room"),
    lvl: sec.lvl ? LEVELS[sec.lvl] : 1,
    pan: sec.pan ? PANS[sec.pan] : 0,
    mot: sec.mot || null,
  };
}
function channelFor(sec) {
  const spec = chanSpec(sec), key = JSON.stringify(spec);
  const got = CHAN.get(key);
  if (got) return got;
  const input = ctx.createGain();
  let node = input;
  const nodes = [input];
  const chain = n => { node.connect(n); node = n; nodes.push(n); };
  // MOTION first, so a filter transition sweeps the section BEFORE its effects
  // rather than after them — closing down onto a reverb tail is a fade, closing
  // down into one is a door shutting.
  let mot = null;
  if (spec.mot === "open" || spec.mot === "close") {
    mot = ctx.createBiquadFilter(); mot.type = "lowpass"; mot.Q.value = 2.2; chain(mot);
  } else if (spec.mot === "rise") {
    mot = ctx.createBiquadFilter(); mot.type = "highpass"; mot.Q.value = 1.6; chain(mot);
  } else if (spec.mot === "pump") {
    mot = ctx.createGain(); chain(mot);
  }
  // BAKED AT BUILD TIME: the tempo-synced inserts (the echo's timeBars, a
  // sweep's rateBars) resolve against the bpm as it is NOW, and a later tempo
  // drag does not re-time them until the chain rebuilds. Same contract the big
  // engine states for its own insert chains — a perceptual-twin class of
  // difference, and re-instantiating every effect on a slider drag is worse.
  let oscs = [], stages = [];
  if (spec.fx.length && SP && SP.buildInsertNodes) {
    try {
      const ch = SP.buildInsertNodes(ctx, fxChain(spec.fx), barSec());
      node.connect(ch.input); node = ch.output; oscs = ch.oscs || [];
      stages = ch.stages || [];
      nodes.push(...(ch.nodes || []));
    } catch (e) { /* an insert that will not build must not take the section with it */ }
  }
  const pan = ctx.createStereoPanner(); pan.pan.value = spec.pan; chain(pan);
  const lvl = ctx.createGain(); lvl.gain.value = spec.lvl; chain(lvl);
  lvl.connect(masterIn);
  const rs = ctx.createGain(); rs.gain.value = spec.rev; lvl.connect(rs);
  rs.connect(verbFor(spec.verb));
  const ds = ctx.createGain(); ds.gain.value = spec.del; lvl.connect(ds); ds.connect(delBus);
  nodes.push(rs, ds);
  // the drum sub-strip: transient-preserving, long-lived, one per channel
  const dHP = ctx.createBiquadFilter(); dHP.type = "highpass"; dHP.frequency.value = DRUM_HPF;
  const dSat = ctx.createWaveShaper(); dSat.curve = satCurve(1 + 3 * DRUM_SAT, DRUM_SATMIX);
  dSat.oversample = "2x";
  dHP.connect(dSat); dSat.connect(input);
  let player = null;
  if (SP && SP.SamplerLive) {
    // every send taps the CHANNEL, so a note's own dry/rev/del all arrive at the
    // same place and the section's sends decide what happens next — exactly the
    // routing live.js uses when a voice carries an insert chain
    try { player = SP.SamplerLive(ctx, { dry: input, rev: input, del: input }); }
    catch (e) { player = null; }
  }
  const c = { key, input, drumIn: dHP, player, mot, motKind: spec.mot, oscs, nodes,
              spec, stages, rs, ds };
  CHAN.set(key, c);
  return c;
}
// WHAT THE MIXER ACTUALLY BUILT, for test/browser/nukernel-audio.test.js. The
// declared chain and the built chain are two different things — buildInsertNodes
// reports what it could not build in `skipped`, and an effect that silently
// passed dry is exactly the failure a screenshot cannot see.
window.__nuMix = () => ({
  master: !!(masterIn && outGain),
  verbs: Object.keys(VERBSPEC),
  // THE COST, in the two currencies that actually bite. A Faust worklet runs
  // every block whether or not it is sounding, so `worklets` is a CPU budget;
  // `convolvers` is the same story for the most expensive single node here.
  worklets: synthNodes.size,
  convolvers: Object.keys(REV).length,
  routes: [...synthOut.values()].reduce((n, m) => n + m.size, 0),
  channels: [...CHAN.values()].map(c => ({
    fx: c.spec.fx, stages: c.stages, motion: c.motKind,
    rev: +c.rs.gain.value.toFixed(3), del: +c.ds.gain.value.toFixed(3),
    level: c.spec.lvl, pan: c.spec.pan, verb: c.spec.verb })),
});
// A TRANSITION IS ARMED WHEN ITS SECTION STARTS, and re-armed on every pass —
// which is what makes it a transition rather than a setting. Silent when the
// channel has no motion node, so the scheduler can call it unconditionally.
function armMotion(chan, when, durSec, spb) {
  if (!chan || !chan.mot) return;
  const p = chan.motKind === "pump" ? chan.mot.gain : chan.mot.frequency;
  try {
    p.cancelScheduledValues(when);
    if (chan.motKind === "open") {
      p.setValueAtTime(320, when); p.exponentialRampToValueAtTime(16000, when + durSec);
    } else if (chan.motKind === "close") {
      p.setValueAtTime(16000, when); p.exponentialRampToValueAtTime(320, when + durSec);
    } else if (chan.motKind === "rise") {
      p.setValueAtTime(20, when); p.exponentialRampToValueAtTime(1400, when + durSec);
    } else {
      // PUMP — a duck on every beat. Not a real sidechain (there is no detector
      // reading the kick), but the same gesture and the same reason: it makes
      // room on the beat, so a busy section breathes instead of smearing.
      for (let t = 0; t < durSec; t += spb) {
        p.setValueAtTime(0.32, when + t);
        p.exponentialRampToValueAtTime(1, when + Math.min(durSec, t + spb * 0.85));
      }
    }
  } catch (e) {}
}
function dropChannels() {
  for (const c of CHAN.values()) {
    for (const o of c.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of c.nodes) { try { n.disconnect(); } catch (e) {} }
    try { c.input.disconnect(); c.drumIn.disconnect(); } catch (e) {}
  }
  CHAN.clear();
  for (const m of synthOut.values()) {
    for (const g of m.values()) { try { g.disconnect(); } catch (e) {} }
    m.clear();
  }
  pruneSynths();
}
// THE POOL IS NOT A CACHE. Nodes survive a channel — they are channel-blind and
// expensive to build, so keeping them across an edit is right — but they must
// not survive the SONG. Every genre you audition leaves its worklet behind, and
// a session spent clicking through fourteen genres ends up rendering a 303, two
// synth basses and eight DX7 operators for a piece that uses none of them. They
// are silent and they cost exactly as much as if they were not.
function pruneSynths() {
  if (!ctx) return;
  const want = new Set();
  if (isSynthFont()) want.add(fontDef().synth.dsp);
  for (const sec of SONG) {
    for (const e of stackOf(sec)) if (GENRES[e.g] && GENRES[e.g].synth) want.add(GENRES[e.g].synth.dsp);
    if (BASSSYNTH[sec.bassop]) want.add(BASSSYNTH[sec.bassop].dsp);
  }
  for (const [k, node] of [...synthNodes]) {
    if (want.has(k.split("#")[0])) continue;
    if (node) { try { node.disconnect(); } catch (e) {} }
    const m = synthOut.get(k);
    if (m) { for (const g of m.values()) { try { g.disconnect(); } catch (e) {} } synthOut.delete(k); }
    synthNodes.delete(k);
  }
}
const masterVol = () => (+document.getElementById("vol").value / 100) * 1.1;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// THE FALLBACK VOICES, counted. They are the sound of something not covered by a
// real instrument, they fire silently, and test/browser/nukernel-audio.test.js
// fails on any of them — but only if it can tell them apart from the oscillators
// the effect LFOs now legitimately start, which is what this counter is for.
window.__nuFallback = 0;
function nz(t, dur, hp, gain, chan) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  // nz is only ever a DRUM noise, so it lands on the channel's drum sub-strip
  s.connect(f); f.connect(g); g.connect((chan && chan.drumIn) || bus); s.start(t); s.stop(t + dur + .02);
}
function line(t, n, dur, acc, sld, prev, tone, padish, vel, chan) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;                       // a completed fade-out is silence
  window.__nuFallback++;
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
  const dest = (chan && chan.input) || bus;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(dest);
  const off = t + dur + tone.rel * .25 + .05;
  o.start(t); o2.start(t); o.stop(off); o2.stop(off);
}
function hit(t, d, acc, vel, chan) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;
  window.__nuFallback++;
  const dest = (chan && chan.drumIn) || bus;
  const a = (acc ? 1.15 : .85) * (0.45 + 0.55 * lvl);
  if (d === "k") { const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(126, t); o.frequency.exponentialRampToValueAtTime(43, t + .09);
    g.gain.setValueAtTime(.95 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .34);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .36); }
  else if (d === "s") { nz(t, .19, 900, .42 * a, chan);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle";
    o.frequency.setValueAtTime(196, t);
    g.gain.setValueAtTime(.3 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .15); }
  else if (d === "c") { [0, .011, .023].forEach(o2 => nz(t + o2, .1, 1400, .3 * a, chan)); }
  else if (d === "o") { nz(t, .26, 6600, .14 * a, chan); }
  else if (d === "h") { nz(t, .035, 7800, .13 * a, chan); }
  else if (d === "p") { nz(t, .05, 2600, .16 * a, chan); }
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
    // GROOVE CAN PUSH THE LAST SIXTEENTH PAST THE BAR LINE, by design — that is
    // what a late note IS. Clamping the BUCKET rather than the time keeps the
    // event in the last bar with an offset a hair over a bar, and since bars are
    // scheduled in sequence with lookahead that lands it at exactly the right
    // moment instead of dropping it on the floor.
    const bucket = e => Math.min(bars - 1, Math.floor(e.t / barSteps));
    for (let b = 0; b < bars; b++)
      TL.push({ si, g, barSteps, first: b === 0,
                ev: ev.filter(e => bucket(e) === b)
                      .map(e => ({ ...e, off: e.t - b * barSteps })) });
  }
}
const stepDur = () => 60 / (+document.getElementById("bpm").value) / 4;

/* ---------- the heartbeat ---------- */
// TWO CLOCKS, and the worker is the one that matters. A hidden tab clamps
// setInterval to about 1 Hz, which starves a 150 ms lookahead seven times out of
// eight — the music comes apart the moment you change tabs, and it looks like an
// audio bug rather than a scheduling one. A dedicated worker is not clamped the
// same way (nukernel/clock.js, a file rather than a blob because the production
// CSP is worker-src 'self'). The main-thread interval stays as a fallback: a
// worker that fails to construct must not take the transport with it, and two
// ticks arriving for one bar is harmless — tick() fills up to a deadline rather
// than emitting one bar per call, so it is idempotent by construction.
let clock = null;
function startClock() {
  clearInterval(timer); timer = setInterval(tick, 25);
  if (clock === false) return;                 // tried once, could not be built
  try {
    if (!clock) { clock = new Worker("clock.js"); clock.onmessage = () => tick(); }
    clock.postMessage({ cmd: "start", ms: 25 });
  } catch (e) { clock = false; }
}
function stopClock() {
  clearInterval(timer); timer = null;
  if (clock) try { clock.postMessage({ cmd: "stop" }); } catch (e) {}
}
// coming BACK to the tab, catch up immediately rather than on the next tick
addEventListener("visibilitychange", () => { if (playing) tick(); });

// THE LOOKAHEAD IS NOT A CONSTANT. 150 ms is right for a tab you are looking at.
// Hidden, even with the worker clock, the whole page is running on the browser's
// leftovers — so widen the window to two seconds and let one tick fill eight bars
// if it has to. Nothing about the music changes; the only cost is that an edit
// made while the tab is hidden takes up to two seconds to be heard, which is a
// cost of exactly zero.
const lookahead = () => (document.visibilityState === "hidden" ? 2.0 : 0.15);
function tick() {
  if (!playing || !TL.length) return;
  const sd = stepDur(), look = ctx.currentTime + lookahead();
  while (nextBarTime < look) {
    if (pendingStart != null) {                    // a queued jump lands on the bar
      const at2 = TL.findIndex(x => x.si === pendingStart && x.first);
      pendingStart = null;
      if (at2 >= 0) nextBar = at2;
      drawSong();
    }
    if (nextBar >= TL.length) nextBar = 0;
    const bar = TL[nextBar];
    const sec = SONG[bar.si], chan = channelFor(sec);
    if (bar.first) {
      passStart = nextBarTime; showSection(bar.si);
      // the section's own echo time, and its transition, both land on the bar it
      // starts — a transition re-arms every pass, which is what makes it one
      setDelayTime(DTIMES[sec.dtime || "d8"]);
      armMotion(chan, nextBarTime, bar.barSteps * sd * boxBars(sec), sd * 4);
      focusSynths(chan, nextBarTime);   // this section's mix owns the synth pool
    }
    for (const e of bar.ev) {
      const when = nextBarTime + e.off * sd;
      if (e.kind === "line") {
        const owner = e.layer || gid(sec);
        // A SYNTH FONT OVERRIDES THE GENRE. Pure FM and Pure Analog are not a
        // sample set, they are "play everything on this voice" — including the
        // genres that carry a signature synth of their own.
        const gsyn = isSynthFont() ? fontDef().synth : GENRES[owner].synth;
        const id = instrOf(owner, e.lv == null ? e.v : e.lv);
        const useSyn = gsyn && !(gsyn.lineOnly && e.pad && !isSynthFont());
        if (useSyn && playSynth(gsyn, e.n, when, e.dur * sd, e.acc, e.sld, e.vel, e.v, chan, e.vox)) { /* signature voice */ }
        else if (!playSampled(id, e.n, when, e.dur * sd, e.vel, 1, chan,
                              e.pad ? STRIPS.pad : STRIPS.lead))
          line(when, e.n, e.dur * sd, e.acc, e.sld, e.prev, bar.g.tone, e.pad, e.vel, chan);
      } else if (e.kind === "hit") {
        const kit = kitOf(sec);
        if (!playDrum(kit, e.d, when, e.acc, e.vel, chan)) hit(when, e.d, e.acc, e.vel, chan);
      }
      else if (e.kind === "bass") {
        const bs = BASSSYNTH[sec.bassop];
        if (bs && playSynth(bs, e.n, when, e.dur * sd, 0, 0, e.vel, 0, chan, e.vox)) { /* synth bass */ }
        else if (!playSampled(BASS_INSTR, e.n, when, e.dur * sd, e.vel, 1.25, chan, STRIPS.bass))
          line(when, e.n, e.dur * sd, 1, 0, null,
            { wave: "square", cut: 340, q: 5, atk: .006, rel: .8, gain: .26 }, false, e.vel, chan);
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
  await loadFont(FONT);
  // NOTHING DECODES WITHOUT AN AudioContext, and every loader caches its
  // failures so a dead zone is not re-fetched every bar. Called before the
  // transport has ever run — switching font or genre on a fresh page — that
  // cache would poison every instrument permanently. Bail before touching them.
  if (!ctx) return false;
  const need = instrumentsInSong().filter(id => {
    const sp = specOf(id); return sp && sp.zones.some(z => !zoneBufs.has(FONT + "|" + id + "|" + z.file));
  });
  const kits = [...new Set(SONG.filter(x => gid(x)).map(x => kitOf(x)).filter(Boolean))]
    .filter(k => !drumBufs.has(k + "|k"));
  // ONE POOL, sized by the widest box in the song — a four-voice fugue over a
  // two-voice rock riff needs six, and nothing needs more than it uses. The
  // pool is NOT multiplied by the number of channels; see synthKey.
  const synths = [...new Set([
    ...(isSynthFont() ? [fontDef().synth] : []),
    ...SONG.flatMap(x => stackOf(x).filter(e => GENRES[e.g].synth).map(e => GENRES[e.g].synth)),
    ...SONG.filter(x => BASSSYNTH[x.bassop]).map(x => BASSSYNTH[x.bassop])])];
  const depth = Math.min(8, Math.max(1, ...SONG.map(sec2 =>
    stackOf(sec2).reduce((n, e) => n + (GENRES[e.g] ? GENRES[e.g].voices : 0), 0))));
  const wantSynth = [];
  for (const sp of synths)
    for (let v = 0; v < depth; v++)
      if (!synthNodes.has(synthKey(sp, v))) wantSynth.push([sp, v, null]);
  if (!need.length && !wantSynth.length && !kits.length) return false;
  if (announce) document.getElementById("readout").textContent =
    "loading " + [...need, ...new Set(wantSynth.map(x => x[0].dsp)), ...kits].join(", ") + "\u2026";
  await Promise.all([...need.map(loadInstrument),
                     ...wantSynth.map(([sp, v, c]) => loadSynth(sp, v, c)),
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
  startClock(); requestAnimationFrame(frame);
  drawSong();
}
function stop() {
  playing = false; stopClock(); playingSec = -1; pendingStart = null;
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
      // A GENRE MAY ASK FOR AN EFFECT. Sludge played clean is not sludge — the
      // distortion is as much the genre as the ♭II is — so a genre carrying `fx`
      // seeds the box's chain when the box has none of its own. The chips light
      // up, so it is an offer you can see and switch off, not a hidden default.
      if (!sec.fx.length && GENRES[value].fx) sec.fx = [...GENRES[value].fx];
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
  else if (kind === "oct") {
    const ent = focused(sec);
    ent.oct = String(optOf(sec, ent, "oct") || "0") === value ? null : value;
  }
  else if (VOX[kind]) {
    // A VOICE KNOB IS PER LAYER, like every other thing about how a line sounds
    // — the dark 303 underneath and the bright one on top are one box.
    const ent = focused(sec);
    if (!ent.vox) ent.vox = {};
    ent.vox[kind] = voxOf(sec, ent, kind) === value ? null : value;
    if (ent.vox[kind] == null) delete ent.vox[kind];
  }
  else if (kind === "fx") {
    // AN INSERT CHAIN IS ORDERED. Chips apply in the order you switch them on,
    // exactly like the pattern operators, and for the same reason: a chorus into
    // a crunch is not a crunch into a chorus.
    if (!sec.fx) sec.fx = [];
    const i = sec.fx.indexOf(value);
    if (i >= 0) sec.fx.splice(i, 1);
    else if (sec.fx.length < MAX_FX) sec.fx.push(value);
  }
  else if (BOXOPTS.has(kind)) sec[kind] = sec[kind] === value ? null : value;
  songChanged();
}
// the plain one-of-these box fields, all toggled the same way
const BOXOPTS = new Set(["kit", "drumkit", "bassop", "swing", "groove", "rev", "del",
                         "verb", "dtime", "lvl", "pan", "mot", "intro", "outro", "role"]);
function songChanged() {
  drawSong(); draw(); drawSlots(); save();
  if (playing) {
    compile();
    ensureAssets(false).then(ok => { if (ok) draw(); });   // fetch what the change needs
  }
  pruneChannels();
}
// CHANNELS ARE CHEAP BUT NOT FREE — an insert chain is real nodes and a synth
// voice is a WASM instance. Keyed by what they are, they accumulate as you try
// things; this drops the ones no box is asking for any more, but only once there
// are enough of them to matter, so an A/B between two chains does not rebuild
// on every click.
function pruneChannels() {
  if (!ctx || CHAN.size <= 8) return;
  const live = new Set(SONG.filter(s => gid(s)).map(s => JSON.stringify(chanSpec(s))));
  for (const [key, c] of [...CHAN]) {
    if (live.has(key)) continue;
    for (const o of c.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of c.nodes) { try { n.disconnect(); } catch (e) {} }
    try { c.input.disconnect(); c.drumIn.disconnect(); } catch (e) {}
    CHAN.delete(key);
    for (const m of synthOut.values()) {
      const g = m.get(key);
      if (g) { try { g.disconnect(); } catch (e) {} m.delete(key); }
    }
  }
}

/* ---------- the song row ---------- */
function drawSong() {
  const el = document.getElementById("song");
  const keep = el.scrollTop;          // the row wraps and grows DOWN now
  el.innerHTML = "";
  SONG.forEach((sec, i) => {
    const bars = boxBars(sec);
    const box = document.createElement("div");
    box.className = "box" + (gid(sec) ? " full" : " empty") +
      (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "") +
      (i === loopOnly ? " looped" : "") + (i === pendingStart ? " queued" : "");
    // THE SONG MUST NOT SCROLL SIDEWAYS. The row is the one view of the whole
    // piece, and a scrolling one means the second half of the song does not
    // exist until you go looking for it — you cannot see the shape of a thing
    // you have to scroll. So the boxes WRAP, and a box's width is capped:
    // beyond MAX_BOX_PX it stops growing, fades out at the right edge and says
    // how long it is instead. Width still means duration up to that point, which
    // is where the reading is useful; past it, the number is the honest answer
    // and a two-metre-wide rectangle was never going to be.
    const want = gid(sec) ? Math.max(116, bars * PX_PER_BAR) : 116;
    const clipped = want > MAX_BOX_PX;
    box.style.width = Math.min(MAX_BOX_PX, want) + "px";
    if (clipped) box.classList.add("clipped");
    box.draggable = true;
    box.setAttribute("aria-label", "box " + (i + 1) +
      (gid(sec) ? ", " + stackLabel(sec) + ", " + bars + " bars" : ", empty"));

    const head = document.createElement("div"); head.className = "bhead";
    // THE ROLE GOES IN THE HEAD, not in the tag pile. A song row is something you
    // read at a glance to find the second chorus, and "chorus" competing with
    // eleven other chips for attention is not a label, it is more noise.
    head.innerHTML = "<b>" + (i + 1) + "</b>" +
      (sec.role ? '<span class="role">' + ROLES[sec.role] + "</span>" : "") +
      "<span>" + bars + " bar" + (bars === 1 ? "" : "s") +
      (sec.nudge ? " +" + sec.nudge : "") +
      // the DURATION, on any box wide enough to have lost its width as a cue —
      // a clipped box has to say in words what it can no longer say in pixels
      (clipped ? " \u00b7 " + mmss(secsOf(sec)) : "") + "</span>" +
      (i === loopOnly ? '<span class="loopmark">loop</span>' : "");
    // BUTTONS, BECAUSE DRAG-AND-DROP IS A DESKTOP FICTION. HTML5 dragstart does
    // not fire on touch at all — not partially, not badly, at all — so reordering
    // a song on a phone was impossible and looked like a bug in the page rather
    // than a missing feature. ◀ ▶ move the box, ⟲ loops it. Drag and double-click
    // still work where they work; these are what make the same actions reachable
    // everywhere, and they are better for the keyboard besides.
    const btn = (cls, glyph, label, fn) => {
      const b2 = document.createElement("button");
      b2.type = "button"; b2.className = cls; b2.textContent = glyph;
      b2.setAttribute("aria-label", label);
      b2.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
      return b2;
    };
    const move = d => {
      const j = i + d;
      if (j < 0 || j >= SONG.length) return;
      const [m] = SONG.splice(i, 1); SONG.splice(j, 0, m);
      viewSec = j; if (loopOnly != null) loopOnly = j;
      songChanged();
      if (playing) { compile(); nextBar = 0; }
    };
    const tools = document.createElement("span"); tools.className = "btools";
    if (i > 0) tools.append(btn("t", "◀", "move box " + (i + 1) + " earlier", () => move(-1)));
    if (i < SONG.length - 1)
      tools.append(btn("t", "▶", "move box " + (i + 1) + " later", () => move(1)));
    tools.append(btn("t" + (i === loopOnly ? " on" : ""), "⟳",
      (i === loopOnly ? "stop looping box " : "loop box ") + (i + 1), () => {
        viewSec = i; loopOnly = loopOnly === i ? null : i;
        drawSong(); draw(); drawSlots();
        if (playing || loopOnly != null) startAt(i);
      }));
    tools.append(btn("x", "×", "remove box " + (i + 1), () => {
      SONG.splice(i, 1);
      if (!SONG.length) SONG.push(emptyBox());
      viewSec = Math.min(viewSec, SONG.length - 1);
      if (loopOnly != null) loopOnly = null;
      songChanged();
      if (playing) { compile(); nextBar = 0; }
    }));
    head.append(tools);
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

    // WHAT THIS BOX IS DOING, as chips, in the order you would read it: what the
    // line is, what the drums are, what the mix is, how it arrives and leaves.
    const tags = document.createElement("div"); tags.className = "btags";
    const fe = i === viewSec ? focused(sec) : stackOf(sec)[0];
    const tag = (cls, text) => tags.append(Object.assign(document.createElement("span"),
      { className: "tag " + cls, textContent: text }));
    for (const o of opsOf(sec, fe)) tag("", OPLABEL[o]);
    const fclamp = optOf(sec, fe, "clamp"), fcmode = optOf(sec, fe, "cmode"),
          fartic = optOf(sec, fe, "artic"), fscale = optOf(sec, fe, "scale"),
          foct = optOf(sec, fe, "oct"), fvox = voxAll(sec, fe);
    if (foct) tag("rng", "oct " + OCTAVES[String(foct)]);
    if (fclamp != null) tag("clp", "limit " + (fclamp === "0" ? "off" : fclamp));
    if (fcmode) tag("clp", fcmode);
    if (fartic) tag("art", fartic);
    if (fscale) tag("rng", SCALELABEL[fscale]);
    if (fvox) for (const [k, v] of Object.entries(fvox)) tag("vox", VOX[k].labels[v]);
    if (sec.kit) tag("kit", KITLABEL[sec.kit]);
    if (sec.drumkit) tag("kit", DRUMKITS[sec.drumkit]);
    if (sec.bassop) tag("bas", BASSOPS[sec.bassop]);
    if (sec.swing) tag("rate", SWINGLABEL[sec.swing]);
    if (sec.groove) tag("rate", GROOVELABEL[sec.groove]);
    if (sec.mode) tag("mode", MODELABEL[sec.mode]);
    if (sec.rate) tag("rate", RATELABEL[sec.rate]);
    for (const f of (sec.fx || [])) tag("fx", FX[f].label);
    if (sec.rev) tag("env", "reverb " + SENDLABEL[sec.rev]);
    if (sec.verb) tag("env", VERBS[sec.verb]);
    if (sec.del) tag("env", "echo " + SENDLABEL[sec.del]);
    if (sec.dtime) tag("env", DTLABEL[sec.dtime]);
    if (sec.lvl) tag("bas", LEVELLABEL[sec.lvl]);
    if (sec.pan) tag("bas", PANLABEL[sec.pan]);
    if (sec.intro) tag("env", "in: " + INLABEL[sec.intro]);
    if (sec.env) tag("env", ENVLABEL[sec.env]);
    if (sec.mot) tag("mode", MOTLABEL[sec.mot]);
    if (sec.outro) tag("env", "out: " + OUTLABEL[sec.outro]);
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

    if (gid(sec)) {
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
  el.scrollTop = keep;
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
let paletteBuilt = false, paletteSig = "", paletteTab = "sound";
const PTABS = [["sound", "sound"], ["line", "line"], ["voice", "voice"],
               ["rhythm", "rhythm"], ["fx", "effects"], ["move", "transitions"]];
// One sentence per tab, and only where the answer is not obvious from the chips.
// The two that need it are the two that are per LAYER — which is a real fact
// about how a stacked box works and used to be repeated, uselessly, on twelve
// separate group labels.
const PNOTE = {
  line: "These apply to the layer you are editing, not to the whole box. " +
        "They compose in the order you switch them on.",
  voice: "Also per layer. The five synth knobs reach any voice that has them — " +
         "the 303, the Model D, the reese and wobble basses.",
  fx: "The whole section goes through this chain, and out to the two sends.",
  move: "Intro and outro replace the first and last bar; the other two shape " +
        "the whole section.",
};
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
  // IS THIS CHIP ON? One function, so the build path and the cheap refresh path
  // can never disagree \u2014 which they had already started to, and a chip that
  // lights up only after a rebuild is indistinguishable from a chip that does
  // not work.
  const isOn = (kind, v) => {
    const ent = LAYER_OPTS.has(kind) || VOX[kind] ? focused(sec) : null;
    if (kind === "genre") return stackOf(sec).some(e => e.g === v);
    if (kind === "op") return opsOf(sec, ent).includes(v);
    if (kind === "focus") return String(focusOf(sec)) === v;
    if (kind === "fx") return sec.fx.includes(v);
    if (VOX[kind]) return voxOf(sec, ent, kind) === v;
    if (kind === "scale") return optOf(sec, ent, "scale") === v;
    if (kind === "clamp") return optOf(sec, ent, "clamp") === v;
    if (kind === "oct") return String(optOf(sec, ent, "oct") || "0") === v;
    if (kind === "cmode") return (optOf(sec, ent, "cmode") || "hold") === v;
    if (kind === "artic") return (optOf(sec, ent, "artic") || "normal") === v;
    return sec[kind] === v;
  };
  if (paletteBuilt) {
    el.querySelectorAll(".pchip").forEach(b => {
      const on = isOn(b.dataset.kind, b.dataset.value);
      b.classList.toggle("on", !!on);
      b.setAttribute("aria-pressed", String(!!on));
    });
    return;
  }
  el.innerHTML = "";
  // TABS, because there are now a hundred and forty of these and a hundred and
  // forty chips in one heap is not a palette, it is a haystack. Six headings,
  // each answering one question about the section, and the question is the
  // heading. (This is also what replaced the "\u00b7 layer" / "\u00b7 box" suffix on every
  // group label: the suffix was on twelve labels and told you the same two
  // things over and over. What is per layer is now said once, at the top of the
  // LINE and VOICE tabs, where it is actually a fact you need.)
  const tabs = document.createElement("div"); tabs.className = "ptabs";
  for (const [k, lab] of PTABS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ptab" + (k === paletteTab ? " on" : "");
    b.textContent = lab; b.setAttribute("aria-pressed", String(k === paletteTab));
    b.addEventListener("click", () => {
      paletteTab = k; paletteBuilt = false; drawPalette();
    });
    tabs.append(b);
  }
  el.append(tabs);
  const note = document.createElement("p"); note.className = "pnote";
  note.textContent = PNOTE[paletteTab] || "";
  if (note.textContent) el.append(note);

  const group = (title, items) => {
    const g = document.createElement("div"); g.className = "pgroup";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
    for (const [kind, value, label, cls] of items) {
      const b = document.createElement("button");
      const on = isOn(kind, String(value));
      b.type = "button"; b.className = "pchip " + (cls || "") + (on ? " on" : "");
      b.textContent = label; b.setAttribute("aria-pressed", String(!!on));
      b.dataset.kind = kind; b.dataset.value = String(value);
      b.addEventListener("click", () => toggle(kind, value));
      g.append(b);
    }
    el.append(g);
  };
  // one row per table, from the table \u2014 a new option is a new entry, never a
  // new line of UI code
  const rowOf = (title, kind, table, cls) =>
    group(title, Object.keys(table).map(k => [kind, k, table[k], cls]));
  const opRow = (title, keys, cls) =>
    group(title, keys.map(k => ["op", k, OPLABEL[k], cls]));

  if (paletteTab === "sound") {
    group("genre", Object.keys(GENRES).map(k => ["genre", k, GENRES[k].label, "gen"]));
    if (stackOf(sec).length > 1)
      group("editing", stackOf(sec).map((e, i) =>
        ["focus", String(i), GENRES[e.g].label + (e.slots.length
          ? " \u00b7 " + e.slots.map(n => n + 1).join("+") : " \u00b7 \u2014"), "foc"]));
    rowOf("section", "role", ROLES, "role");
    rowOf("chord mode", "mode", MODELABEL, "mode");
    rowOf("tempo", "rate", RATELABEL, "rate");
    rowOf("articulation", "artic", { staccato: "staccato", normal: "normal",
                                     legato: "legato", tie: "tie" }, "art");
  } else if (paletteTab === "line") {
    opRow("pattern", ["rev", "inv", "gateflip", "accflip", "slides", "stick"], "");
    opRow("rotate", ["rot1", "rot2", "rot3", "rot4", "rot5", "rot6", "rot7"], "lst");
    opRow("rotate rhythm only", ["gat2", "gat4", "gat8"], "lst");
    opRow("rotate pitch only", ["pit2", "pit4", "pit8"], "lst");
    opRow("split", ["rep2", "rep3", "rep4", "rep5", "rep6", "rep7", "rep8"], "lst");
    opRow("delete", ["del2", "del3", "del4", "del5", "del6", "del7", "del8"], "lst");
    opRow("thin", ["thin2", "thin3", "thin4"], "lst");
    opRow("fill in", ["dens2", "dens3", "dens4"], "lst");
    opRow("loop a fragment", ["ex4", "ex8"], "lst");
    opRow("shift degrees", ["trm2", "trm1", "trp1", "trp2"], "lst");
  } else if (paletteTab === "voice") {
    rowOf("register", "oct", OCTAVES, "rng");
    group("width", [["op", "wide", OPLABEL.wide, "rng"],
                    ["op", "tight", OPLABEL.tight, "rng"]]);
    rowOf("alphabet", "scale", SCALELABEL, "rng");
    rowOf("filter", "cut", VOX.cut.labels, "vox");
    rowOf("resonance", "res", VOX.res.labels, "vox");
    rowOf("env mod", "emod", VOX.emod.labels, "vox");
    rowOf("decay", "dec", VOX.dec.labels, "vox");
    rowOf("waveform", "wave", VOX.wave.labels, "vox");
    group("ramp limit", ["0", "2", "4", "8"].map(v =>
      ["clamp", v, v === "0" ? "off" : v, "clp"]));
    rowOf("at the limit", "cmode", { hold: "hold", loop: "loop", reverse: "reverse" }, "clp");
  } else if (paletteTab === "rhythm") {
    rowOf("drum pattern", "kit", KITLABEL, "kit");
    rowOf("drum sound", "drumkit", DRUMKITS, "kit");
    rowOf("bass", "bassop", BASSOPS, "bas");
    rowOf("swing", "swing", SWINGLABEL, "rate");
    rowOf("groove", "groove", GROOVELABEL, "rate");
  } else if (paletteTab === "fx") {
    group("effects (up to " + MAX_FX + ", in the order you switch them on)",
      Object.keys(FX).map(k => ["fx", k, FX[k].label, "fx"]));
    rowOf("reverb", "rev", SENDLABEL, "env");
    rowOf("space", "verb", VERBS, "env");
    rowOf("echo", "del", SENDLABEL, "env");
    rowOf("echo time", "dtime", DTLABEL, "env");
    rowOf("level", "lvl", LEVELLABEL, "bas");
    rowOf("place", "pan", PANLABEL, "bas");
  } else {
    rowOf("intro", "intro", INLABEL, "env");
    rowOf("outro", "outro", OUTLABEL, "env");
    rowOf("level over the section", "env", ENVLABEL, "env");
    rowOf("filter over the section", "mot", MOTLABEL, "mode");
  }
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
// WHICH WAY A TAP MOVES A VALUE. The ± button in the editor header rides this,
// and it exists because shift-click does not exist on a phone.
let stepDir = 1;
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
      // SHIFT-CLICK IS NOT A GESTURE ON A PHONE. It was the only way to lower a
      // value, so half of the phrase editor was unreachable on touch — you could
      // raise a degree and never put it back. Three ways in now, and all three
      // work everywhere:
      //   drag       up/down on a cell scrubs it (pointer events, so touch too)
      //   tap        moves it by the ± toggle in the header
      //   shift-tap  inverts that, for the keyboard-and-mouse habit
      // The binary rows are unaffected: a toggle has nowhere to go but the other
      // way, so a tap has always been enough.
      if (num) {
        let from = null, base = 0, moved = false;
        b.addEventListener("pointerdown", ev => {
          from = ev.clientY; base = SUBJ[key][i]; moved = false;
          try { b.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        b.addEventListener("pointermove", ev => {
          if (from == null) return;
          const step = Math.round((from - ev.clientY) / 14);   // up is more
          if (!step) return;
          const v = clamp(base + step, num);
          if (v === SUBJ[key][i]) return;
          moved = true; SUBJ[key][i] = v;
          drawEditor(); drawSlots(); drawSong(); draw(); if (playing) compile();
        });
        const end = () => { if (moved) save(); from = null; };
        b.addEventListener("pointerup", end);
        b.addEventListener("pointercancel", end);
        b.addEventListener("click", ev => {
          if (moved) { moved = false; return; }              // that was a scrub
          SUBJ[key][i] = clamp(SUBJ[key][i] + (ev.shiftKey ? -stepDir : stepDir), num);
          drawEditor(); drawSlots(); drawSong(); draw(); save(); if (playing) compile();
        });
      } else {
        b.addEventListener("click", () => {
          SUBJ[key][i] = SUBJ[key][i] ? 0 : 1;
          drawEditor(); drawSlots(); drawSong(); draw(); save(); if (playing) compile();
        });
      }
      el.append(b);
    }
  }
}

/* ---------- what the selected box asks for ---------- */
function writeSrc() {
  const sec = curSection(), out = document.getElementById("src");
  if (!gid(sec)) { out.textContent = "(empty box)"; return; }
  const g = genreOf(sec), cs = chanSpec(sec);
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
      : "none") + "\n" +
    // THE CHANNEL, in the same terms the palette used to ask for it. A box that
    // sounds wrong is usually a mix question, and until this line existed the
    // panel could tell you everything about the notes and nothing about the mix.
    "channel    " + (sec.fx && sec.fx.length ? sec.fx.map(k => FX[k].label).join(" -> ")
                                             : "no inserts") + "\n" +
    "sends      reverb " + Math.round(cs.rev * 100) + "% -> " + cs.verb +
      " · echo " + Math.round(cs.del * 100) + "%" +
      (sec.dtime ? " at " + DTLABEL[sec.dtime] : "") + "\n" +
    "place      level " + cs.lvl.toFixed(2) + " · pan " + cs.pan.toFixed(2) +
      (cs.mot ? " · " + MOTLABEL[cs.mot] : "") + "\n" +
    "edges      " + (sec.intro ? INLABEL[sec.intro] : "straight in") + " / " +
      (sec.outro ? OUTLABEL[sec.outro] : "straight out") + "\n\n" +
    "kit        " + (kitOf(sec) || "none") + "\n" + kit;
}

/* ---------- wiring ---------- */
document.getElementById("play").addEventListener("click",
  () => playing ? stop() : (loopOnly = null, startAt(0)));
document.getElementById("bpm").addEventListener("input", e => {
  document.getElementById("bpmv").textContent = e.target.value; save();
});
document.getElementById("vol").addEventListener("input", e => {
  document.getElementById("volv").textContent = e.target.value;
  if (outGain) outGain.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
  save();
});
const putPhrase = make => () => {
  SLOTS[slot] = make(); SUBJ = SLOTS[slot];
  drawSlots(); drawEditor(); drawSong(); draw(); save(); if (playing) compile();
};
{
  const b = document.getElementById("stepdir");
  b.addEventListener("click", () => {
    stepDir = -stepDir;
    b.textContent = stepDir > 0 ? "Tap raises" : "Tap lowers";
    b.setAttribute("aria-pressed", String(stepDir < 0));
  });
}
document.getElementById("seed").addEventListener("click", putPhrase(() => structuredClone(DEFAULT)));
document.getElementById("rnd").addEventListener("click", putPhrase(randomPhrase));
document.getElementById("clear").addEventListener("click", putPhrase(blank));
// ---- fonts ----
{
  const sel = document.getElementById("font");
  for (const f of FONTS) {
    const o = document.createElement("option");
    o.value = f.key; o.textContent = f.label + (f.kind === "synth" ? "  (synth)" : "");
    sel.append(o);
  }
  sel.value = FONT;
  sel.addEventListener("change", async e => {
    FONT = e.target.value;
    initAudio();                       // a select change is a user gesture
    document.getElementById("readout").textContent = "loading " + fontDef().label + "\u2026";
    await ensureAssets(false);
    draw(); save();
    if (playing) compile();
  });
}

// ---- the composer ----
// ONE BUTTON. It writes eight phrases and an arrangement of them — nine boxes
// with roles, its own tempo, its own groove, its own mix — and hands the result
// to applyState, the SAME validate-and-apply path a file off the desktop takes.
// If the composer ever emitted a song the loader would refuse, the loader
// refuses it and says so, rather than there being a second, more trusted way in.
{
  const sel = document.getElementById("composeg");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "surprise me" }));
  for (const k of Object.keys(GENRES))
    sel.append(Object.assign(document.createElement("option"),
      { value: k, textContent: GENRES[k].label }));
  document.getElementById("compose").addEventListener("click", () => {
    const keys = Object.keys(GENRES);
    const gk = sel.value || keys[Math.floor(Math.random() * keys.length)];
    // the seed is not exposed as a control, but it IS a real seed: the same
    // number is the same song, which is what makes the composer testable
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const song = compose(gk, seed);
    if (!applyState(song)) {
      document.getElementById("readout").textContent =
        "the composer produced a song the loader rejected — that is a bug, not a taste";
      return;
    }
    if (playing) stop();
    dropChannels();
    viewSec = 0; playingSec = -1; loopOnly = null; slot = 0; SUBJ = SLOTS[0];
    paletteBuilt = false;
    drawPalette(); drawSlots(); drawEditor(); drawSong(); draw(); save();
    document.getElementById("readout").textContent =
      GENRES[gk].label + " · seed " + seed + " · " +
      song.song.map(b => b.role).join(" → ") + "  —  press play";
  });
}

// ---- preset songs ----
{
  const sel = document.getElementById("preset");
  for (const p2 of PRESETS) {
    const o = document.createElement("option");
    o.value = p2.name; o.textContent = p2.name; sel.append(o);
  }
  sel.addEventListener("change", e => {
    const p2 = PRESETS.find(x => x.name === e.target.value);
    e.target.selectedIndex = 0;
    if (!p2) return;
    if (!applyState(JSON.parse(JSON.stringify(p2.data)))) {
      document.getElementById("readout").textContent = "that preset failed to load";
      return;
    }
    if (playing) stop();
    dropChannels();                 // a new song is a new mix; keep no old ones
    viewSec = 0; playingSec = -1; loopOnly = null; slot = 0; SUBJ = SLOTS[0];
    paletteBuilt = false;
    drawPalette(); drawSlots(); drawEditor(); drawSong(); draw(); save();
  });
}

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
  dropChannels(); paletteBuilt = false;
  viewSec = 0; playingSec = -1; loopOnly = null;
  const bpm = document.getElementById("bpm");
  bpm.value = DEFAULT_BPM; document.getElementById("bpmv").textContent = String(DEFAULT_BPM);
  const vol = document.getElementById("vol");
  vol.value = 80; document.getElementById("volv").textContent = "80";
  if (outGain) outGain.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
  drawSlots(); drawEditor(); drawSong(); draw();
  document.getElementById("dawscroll").scrollLeft = 0;
});
addEventListener("resize", () => draw());

load();
drawSlots(); drawEditor(); drawSong(); draw();
