// nukernel/export/move.js — a Stellate song becomes an Ableton Move Set, by REWRITING A
// DONOR the device itself saved. Pure functions over data: no I/O, no node builtins, and
// the nukernel tier arrives as an argument, so the page can import this exact file the way
// it imports als.js.
//
// SAME METHOD AS THE .als SIDE, FOR THE SAME REASON. als.js: "we do NOT write it from a
// spec; we splice a DONOR set saved from Paul's own Live 12". A Move Set is a Song.abl —
// JSON, schema-stamped, undocumented — and the donor here is a Set Move 2.1 wrote
// (tools/move/donor/Song.abl). Its instruments, mixer, master chain and device grammar
// ship untouched; this file replaces the clips, the scenes, the tempo, the key, the scale
// and the time signature, and swaps in core-library Track Presets for the four
// instruments. Anything it emits therefore already exists in a file Move wrote.
//
// WHAT MOVE REFUSES, WHICH NOTHING DOCUMENTS. Move validates a Set on load and rejects the
// whole file with "Document invariant violation" — per device, with no line number. Two
// rules were found the slow way, by bisecting a rejected Set against the donor one clip and
// then one note at a time (tools/move/minimize.py, tools/move/ddnotes.py):
//
//   1. A CLIP MAY NOT SOUND ONE PITCH TWICE AT ONCE. Two notes of the same pitch may not
//      overlap, and may not even MEET — one ending exactly where the next begins is
//      refused too, as is the sliver left behind when you trim an overlap to touch. Both
//      shapes come out of the composer: a long chord tone rings into a later note of its
//      own pitch, and humanising lands two hits on one drum pad a few thousandths of a
//      beat apart. 475 of 509 genres produced at least one such clip, so effectively every
//      Set was refused. `noOverlaps` below is the fix, and move-gate.js gate N is what
//      keeps it fixed.
//   2. noteNumber MUST BE A WHOLE NUMBER. Four genres (dastgah, tasnif, tarab, gamelan)
//      compose in quarter tones, which Move cannot hold at all; they land on the nearest
//      key and gamelan becomes a different piece of music for it. Move's own words for the
//      refusal are `cannot convert to i: noteNumber`.
//
// AND ONE IT DOES NOT CHECK: `scale`. A Set saying "Nonsense Scale" loads happily, so a
// wrong name costs the player Move's pad highlighting silently rather than erroring. The
// names in SCALE below were read out of /opt/move/MoveOriginal.
//
// THE LOAD IS MACHINE-CHECKABLE HERE, unlike Live. als-gate.js has to end at "GATE 4 —
// PAUL: open it and say whether it opens"; Move answers for itself. Its SongRenderer, over
// D-Bus, loads a Set before rendering any audio and logs either `Start rendering song` or
// `Couldn't render song: <reason>` — a full-fidelity verdict in about five seconds, with no
// UI and nothing installed. tools/move/probe.sh drives it and move-gate.js gate 4 runs it.

// ---- 1. the song as sections x 4 Move tracks ----------------------------------

export function sections(ns) {
  const { NG, K, Doc, P, wiki } = ns;
  const GENRES = NG.GENRES;
  const WINDOW = [null, [28, 55], [48, 79], [55, 84]];

  function sectionEvents(doc, i, leadIdx) {
    const g = Doc.toGenre(doc, i, GENRES);
    const sec = doc.form.sections[i];
    const lines = doc.voices.filter((v) => v.kind === "line");
    const phrases = lines.map((c) => {
      const m = Doc.materialAt(c, sec.id);
      return m == null ? null : Doc.toPhrase(doc, m);
    });
    const cb = Doc.barsOf(doc);
    const musical = Math.max(1, sec.bars * cb);
    const barSteps = K.stepsIn(g) / g.rate;
    const total = Math.ceil(musical / g.bars) * g.bars;
    const to = musical * barSteps;
    const out = [];
    const nP = phrases.length;
    phrases.forEach((ph, pi) => {
      if (!ph) return;
      const evs = K.render(ph, g, total);
      for (let v = pi; v < g.voices; v += nP)
        for (const e of evs) if (e.v === v)
          out.push(Object.assign({}, e, { track: pi === leadIdx ? 3 : 2 }));
    });
    const lead = phrases.find(Boolean);
    const kitOn = doc.voices.some((v) => v.kind === "drums");
    const hasBass = doc.voices.some((v) => v.kind === "bass") && !g.nobass;
    if (lead) {
      if (kitOn) {
        const dr = K.drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
        for (let r = 0; r < Math.ceil(total / g.bars); r++)
          for (const e of dr) out.push(Object.assign({}, e, { track: 0, t: e.t + r * loopSteps }));
      }
      if (hasBass) for (const e of K.bass(lead, g, total)) out.push(Object.assign({}, e, { track: 1 }));
    }
    const qPerUnit = (K.stepsIn(g) / 4) / barSteps;
    return { events: out.filter((e) => e.t >= 0 && e.t < to && (e.vel == null || e.vel > 0)),
             beats: to * qPerUnit, qPerUnit };
  }

  const partOf = (v) => (v.cast && v.cast.part) || "line";
  const KEYS_ORDER = ["pad", "stab", "drone", "riff", "counter", "line", "lead"];

  // Which line voice is the song's tune (Move track 4): the sung melody if the
  // song has one, else the first "lead" part, then "line", then riff/counter.
  function leadOf(lines) {
    const part = (v) => (v.cast && v.cast.part) || "line";
    const sung = lines.findIndex((v) => part(v) === "lead" && /vox/.test(v.instrument || ""));
    if (sung >= 0) return sung;
    for (const want of ["lead", "line", "riff", "counter"]) {
      const i = lines.findIndex((v) => part(v) === want);
      if (i >= 0) return i;
    }
    return lines.length ? 0 : -1;
  }

  // drumMap: lane letter -> MIDI note on the kit (see kitmap.cjs)
  function songSections(gk, seed, drumMap) {
    if (!GENRES[gk]) throw new Error("unknown genre " + gk);
    const doc = P.genreToDocument(gk, seed);
    const lines = doc.voices.filter((v) => v.kind === "line");
    const leadIdx = leadOf(lines);
    const sections = doc.form.sections.map((sec, i) => {
      const r = sectionEvents(doc, i, leadIdx);
      const tracks = [[], [], [], []];
      for (const e of r.events) {
        const vel = Math.max(1, Math.min(127, Math.round(24 + (e.vel == null ? 6 : e.vel) * 11 + (e.acc ? 8 : 0))));
        const start = e.t * r.qPerUnit;
        if (e.track === 0) {
          const n = drumMap[e.d];
          if (n != null) tracks[0].push({ n, t: start, d: 0.25, v: vel });
        } else {
          tracks[e.track].push({ n: e.n, t: start, d: Math.max(0.0625, (e.dur || 1) * r.qPerUnit * 0.98), v: vel });
        }
      }
      // One note per pitch per instant: lanes that share a pad, and voices that
      // double a pitch, merge (loudest velocity, longest duration). A clip
      // with stacked identical notes is not something Move would ever write.
      const merged = tracks.map((ns) => {
        const at = new Map();
        for (const x of ns) {
          const k = x.n + "@" + Math.round(x.t * 960);
          const y = at.get(k);
          if (!y) at.set(k, Object.assign({}, x));
          else { y.v = Math.max(y.v, x.v); y.d = Math.max(y.d, x.d); }
        }
        return [...at.values()];
      });
      return { role: sec.role, beats: r.beats, tracks: merged };
    });
    // one octave move per pitched track, whole song, contour intact
    for (let t = 1; t < 4; t++) {
      const all = [];
      sections.forEach((s) => s.tracks[t].forEach((x) => all.push(x.n)));
      const k = K.homeFor(all, WINDOW[t]);
      sections.forEach((s) => s.tracks[t].forEach((x) => { x.n = Math.max(0, Math.min(127, x.n + 12 * k)); }));
    }
    const A = doc.alphabet || {};
    return { gk, seed, label: GENRES[gk].label || gk, title: titleOf(gk),
             bpm: doc.time.bpm, meter: doc.time.meter,
             key: A.key, mode: A.mode, sections };
  }

  // What to call a genre on screen and in a Set name. Stellate labels an anchor by
  // where and when ("Chicago 1987"); the place is the one thing a player has no use
  // for, so the genre's own name goes first and the year stays: "Acid house 1987".
  // The name comes from `ns.wiki` -- nukernel/wiki.js, which resolves every anchor to a
  // Wikipedia article and owns the reader-facing name in name(key). The anchors with no
  // name there are parts, not genres, and their labels already read as names ("Pad").
  function titleOf(gk) {
    const label = (GENRES[gk] && GENRES[gk].label) || gk;
    const name = wiki && wiki.name ? wiki.name(gk) : null;
    if (!name) return label;
    const y = yearOf(label);
    if (y == null) return name;
    return name + " " + (y < 0 ? -y + " BC" : y);
  }

  // The year in a label: "Chicago 1987" -> 1987, "Rome 17 BC" -> -17; none -> null.
  function yearOf(label) {
    const m = String(label || "").match(/\b(\d{1,5})\s*(BC|BCE)?\b/i);
    if (!m) return null;
    return m[2] ? -Number(m[1]) : Number(m[1]);
  }

  // Chronological: oldest first; labels without a year go last, alphabetically.
  function genreList() {
    const order = (P.anchors && P.anchors()) || Object.keys(GENRES);
    return order.filter((k) => GENRES[k] && !GENRES[k].silent)
      .map((k) => ({ key: k, label: GENRES[k].label || k, title: titleOf(k),
                     name: (wiki && wiki.name ? wiki.name(k) : null), year: yearOf(GENRES[k].label) }))
      .sort((a, b) => (a.year == null) - (b.year == null) || (a.year || 0) - (b.year || 0) ||
                      a.title.localeCompare(b.title) || a.key.localeCompare(b.key));
  }

  // What each Move track should sound like, in Stellate's own words
  // (cheap: the document only, no notes).
  function instrumentsOf(gk, seed) {
    const doc = P.genreToDocument(gk, seed);
    const G = GENRES[gk];
    const lines = doc.voices.filter((v) => v.kind === "line");
    const leadIdx = leadOf(lines);
    const drums = doc.voices.find((v) => v.kind === "drums");
    const bass = doc.voices.find((v) => v.kind === "bass");
    return {
      year: yearOf(G.label),
      drums: drums ? drums.instrument || null : null,
      bass: (bass && bass.instrument) || G.bassInstr || null,
      // keys: the harmony voices first (pad, stab, riff…), then the rest
      keys: lines.map((v, i) => ({ v, i })).filter((x) => x.i !== leadIdx && x.v.instrument)
        .sort((a, b) => KEYS_ORDER.indexOf(partOf(a.v)) - KEYS_ORDER.indexOf(partOf(b.v)) || a.i - b.i)
        .map((x) => x.v.instrument),
      // lead: a sung tune gets the song's melodic instrument (its sax, flute,
      // piano…) as the sound to look for, with the voice itself as a last resort
      lead: leadIdx < 0 ? null : (() => {
        const own = lines[leadIdx].instrument || null;
        if (!/vox/.test(own || "")) return own;
        const alt = lines.find((v, i) => i !== leadIdx && ["lead", "line", "riff"].includes(partOf(v)) && v.instrument && !/vox|choir|voices/.test(v.instrument));
        return alt ? [alt.instrument, own] : own;
      })(),
      synth: !!G.synth,
    };
  }

  return { songSections, genreList, instrumentsOf, yearOf, titleOf };
}

// ---- 2. sections -> the shortest exact loops, 8 scene rows, Song Mode --------

const Q = 96;                  // quantize grid, per beat, for comparing notes
export const MAX_LOOP_BARS = 32;         // Move stores long clips (its own template has 8+ bar ones)

const key = (x) => x.n + "@" + Math.round(x.t * Q) + ":" + Math.round(x.d * Q) + ":" + x.v;

// Smallest L (bars, dividing the section) whose every window equals window 0.
export function loopOf(notes, bars, beatsPerBar) {
  if (!notes.length) return { bars: 0, notes: [], exact: true };
  for (let L = 1; L <= Math.min(bars, MAX_LOOP_BARS); L++) {
    if (bars % L) continue;
    const span = L * beatsPerBar;
    const win = new Map();
    for (const x of notes) {
      const w = Math.floor(x.t / span + 1e-9);
      const k = key({ n: x.n, t: x.t - w * span, d: x.d, v: x.v });
      if (!win.has(w)) win.set(w, []);
      win.get(w).push(k);
    }
    const first = (win.get(0) || []).slice().sort().join("|");
    let ok = true;
    for (let w = 0; w < bars / L && ok; w++) ok = (win.get(w) || []).slice().sort().join("|") === first;
    if (ok) {
      return { bars: L, beats: span, exact: true,
               notes: notes.filter((x) => x.t < span - 1e-9)
                           .map((x) => ({ n: x.n, t: x.t, d: Math.min(x.d, span - x.t), v: x.v })) };
    }
  }
  const L = Math.min(bars, MAX_LOOP_BARS), span = L * beatsPerBar;
  return { bars: L, beats: span, exact: L === bars,
           notes: notes.filter((x) => x.t < span - 1e-9)
                       .map((x) => ({ n: x.n, t: x.t, d: Math.min(x.d, span - x.t), v: x.v })) };
}

const clipId = (c) => c.bars + "/" + c.notes.map(key).sort().join("|");

function similarity(a, b) {           // Jaccard over note keys, 0..1
  if (!a || !b) return 0;
  const A = new Set(a.notes.map(key)), B = new Set(b.notes.map(key));
  let i = 0; for (const k of A) if (B.has(k)) i++;
  const u = A.size + B.size - i;
  return u ? i / u : 1;
}

export function plan(song) {
  // the song's own bar: "three" = 3 beats, "7/8" = 3.5; default 4/4
  const m = song.meter;
  const beatsPerBar = m === "three" ? 3 : m === "six" ? 3
    : (typeof m === "string" && /^\d+\/\d+$/.test(m)) ? (4 * +m.split("/")[0] / +m.split("/")[1]) : 4;
  // 1. every section as 4 loops
  const secs = song.sections.map((s) => {
    const bars = Math.max(1, Math.round(s.beats / beatsPerBar));
    const clips = s.tracks.map((notes) => {
      const c = loopOf(notes, bars, beatsPerBar);
      return c.bars ? Object.assign(c, { id: clipId(c) }) : null;
    });
    return { role: s.role, bars, clips };
  });
  // 2. unique sections (tuple of clip ids), in order of first appearance
  const tupleOf = (s) => s.clips.map((c) => (c ? c.id : "-")).join("§");
  const uniq = [];
  const weight = new Map();
  secs.forEach((s) => {
    const k = tupleOf(s);
    if (!weight.has(k)) { weight.set(k, 0); uniq.push(s); }
    weight.set(k, weight.get(k) + s.bars);
  });
  // 3. SCENES FIRST. Each of the first 8 distinct sections gets a whole row,
  //    every track filled (a clip shared with another row is copied), so
  //    launching a scene on Move plays that section as written. Sections past
  //    the eighth are played by Song Mode from these clips: per track, the
  //    identical clip wherever it sits, else the closest one on that track.
  const rows = uniq.slice(0, 8);
  const columns = [[], [], [], []];
  rows.forEach((s, r) => { for (let t = 0; t < 4; t++) columns[t][r] = s.clips[t] || null; });
  const rowOf = new Map(rows.map((s, r) => [tupleOf(s), r]));
  let approx = 0;
  const entries = secs.map((s) => {
    const r = rowOf.get(tupleOf(s));
    const pads = s.clips.map((clip, t) => {
      if (r != null) return clip ? r : (columns[t].some((c) => !c) ? columns[t].findIndex((c) => !c) : null);
      if (!clip) { const e = columns[t].findIndex((c) => !c); return e >= 0 ? e : null; }
      const same = columns[t].findIndex((cc) => cc && cc.id === clip.id);
      if (same >= 0) return same;
      approx++;
      let best = -1, bestSim = -1;
      columns[t].forEach((cc, c) => { if (cc) { const sim = similarity(cc, clip); if (sim > bestSim) { bestSim = sim; best = c; } } });
      return best >= 0 ? best : null;
    });
    if (r != null) s.clips.forEach((clip, t) => { if (!clip && pads[t] !== r && columns[t][r] == null) pads[t] = r; });
    const loopBars = Math.max(1, ...pads.map((c, t) => (c == null || !columns[t][c] ? 0 : columns[t][c].bars)));
    // Song Mode plays an entry for (longest clip × repeats); when a borrowed clip
    // doesn't divide the section, give the entry its exact length instead.
    const fits = s.bars % loopBars === 0;
    return { role: s.role, bars: s.bars, beats: s.bars * beatsPerBar, row: r, pads, loopBars,
             mode: fits ? "longest" : "custom",
             repeats: fits ? s.bars / loopBars : 1,
             // Schwung's Song Mode counts a bar as 4 beats whatever the Set's time
             // signature is (barDurationMs = 60000 / tempo * 4 in its ui.js), so this
             // stays in 4-beat bars even when the Set is in 3/4 or 7/8.
             customBars: fits ? 1 : Math.max(1, Math.min(64, Math.round(s.bars * beatsPerBar / 4))) };
  });
  const scenes = rows;
  const inexact = secs.reduce((n, s) => n + s.clips.filter((c) => c && !c.exact).length, 0);
  // scene names: role, numbered when repeated ("verse", "verse 2")
  const seen = {};
  const names = scenes.map((s) => { seen[s.role] = (seen[s.role] || 0) + 1; return seen[s.role] > 1 ? s.role + " " + seen[s.role] : s.role; });
  return { beatsPerBar, scenes: scenes.map((s, c) => ({ name: names[c], role: s.role })), columns, entries,
           stats: { sections: secs.length, unique: uniq.length, scenes: scenes.length,
                    approxTrackPicks: approx, truncatedLoops: inexact } };
}

// ---- 3. which core-library instrument each track gets -------------------------

// Stellate / GM instrument -> words to look for in preset names, best first.
const WORDS = [
  [/^tr808$/, ["808"]],
  [/^tr909$/, ["909"]],
  [/^cr78$/, ["CR-78", "CR78", "78"]],
  [/^electronic$/, ["Electro", "Machine", "Digital", "Kit"]],
  [/^(brush|jazz)$/, ["Brush", "Jazz", "Acoustic"]],
  [/^(room|acoustic)$/, ["Acoustic", "Studio", "Room", "Live", "Vintage"]],
  [/^power$/, ["Rock", "Power", "Big", "Acoustic"]],
  [/contrabass|^upright$/, ["Upright", "Double", "Acoustic Bass", "Jazz"]],
  [/finger_bass|pop_bass|picked_bass|fretless/, ["Finger", "Electric Bass", "Picked", "Fretless", "Bass Guitar", "P-Bass", "Precision"]],
  [/slap_bass/, ["Slap", "Funk"]],
  [/bass_lead|synth_bass/, ["Sub", "Synth", "Acid", "303", "Analog", "Moog", "Reese"]],
  [/grand|upright_piano|honky|felt_piano|piano/, ["Grand", "Piano", "Upright", "Felt"]],
  [/rhodes|electric_piano|legend_ep|_ep/, ["E-Piano", "EP", "Rhodes", "Electric Piano", "Wurli", "Suitcase"]],
  [/organ/, ["Organ", "B3", "Church", "Drawbar"]],
  [/clavinet|harpsichord/, ["Clav", "Harpsichord"]],
  [/synth_strings|slow_strings|^strings$/, ["Strings", "String", "Orchestra", "Ensemble"]],
  [/violin|fiddle|viola|cello|erhu/, ["Violin", "Fiddle", "Cello", "Strings"]],
  [/pad|bowed_glass|sea_shore|space_voice/, ["Pad", "Atmos", "Warm", "Air", "Drone"]],
  [/ahh_choir|ohh_voices|synth_voice/, ["Choir", "Voices", "Vox", "Aah", "Ooh"]],
  [/solo_vox/, ["Vox", "Vocal", "Voice", "Whistle", "Theremin", "Lead"]],
  [/distortion_guitar|overdrive_guitar|crunch_guitar/, ["Distort", "Overdrive", "Crunch", "Rock Guitar", "Guitar"]],
  [/guitar|banjo|^lute$|^oud$|sitar|koto|shamisen|dulcimer|^harp$|charang/, ["Guitar", "Pluck", "Nylon", "Harp", "Koto", "Sitar", "Banjo"]],
  [/brass|trumpet|horn|trombone|tuba|synth_brass/, ["Brass", "Horn", "Trumpet", "Stab"]],
  [/sax/, ["Sax", "Tenor", "Alto", "Brass"]],
  [/flute|recorder|pan_flute|shakuhachi|whistle/, ["Flute", "Pipe", "Whistle", "Recorder", "Pan"]],
  [/clarinet|oboe|english_horn|bassoon/, ["Clarinet", "Oboe", "Woodwind", "Reed"]],
  [/accordion|bandoneon|harmonica|reed_organ/, ["Accordion", "Harmonica", "Reed", "Squeeze"]],
  [/vibraphone|marimba|glockenspiel|kalimba|music_box|tubular|steel_drums|celesta/, ["Vibes", "Vibraphone", "Marimba", "Mallet", "Bell", "Glock", "Kalimba"]],
  [/polysynth|^synth$|saw|square|fifth|lead/, ["Lead", "Saw", "Poly", "Synth", "Analog"]],
  [/orchestra_hit|stab/, ["Stab", "Hit", "Brass"]],
];

const ROLE_CAT = [/^drums\b/i, /^bass\b/i, null, null];              // allowed category, by role
const NOT_TONAL = /^(drums|bass|percussion|fx|sfx|textures?|one ?shots?)\b/i;
const FALLBACK_CAT = [/drum/i, /bass/i, /piano|keys|pad|organ/i, /lead|synth|pluck/i];

function wordsFor(inst) {
  if (!inst) return [];
  const out = [];
  for (const [re, words] of WORDS) if (re.test(inst)) for (const w of words) if (!out.includes(w)) out.push(w);
  return out;
}

function hash(str) {                          // FNV-1a, for stable tie-breaks
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// Fill in what Stellate doesn't name, from era and style.
function roleHints(h) {
  const electronic = /^(tr|cr|electronic)/.test(h.drums || "") || h.synth;
  let bass = h.bass;
  if (!bass) bass = electronic ? "synth_bass" : (h.year != null && h.year < 1955) || /brush|jazz/.test(h.drums || "") ? "contrabass" : "finger_bass";
  const keys = h.keys && h.keys.length ? h.keys : [electronic ? "warm_pad" : "upright_piano"];
  let lead = h.lead || (electronic ? "saw_wave" : "clean_guitar");
  if (lead === "solo_vox") lead = [electronic ? "saw_wave" : "flute", "solo_vox"];   // a voice alone: lead-ish sound
  return [h.drums || (electronic ? "electronic" : "acoustic"), bass, keys, lead];
}

function pick(index, role, insts, seed, taken) {
  const cat = ROLE_CAT[role];
  const pool = index.filter((p) => (cat ? cat.test(p.cat) : !NOT_TONAL.test(p.cat)) && !taken.has(p.rel));
  if (!pool.length) return null;
  const list = Array.isArray(insts) ? insts : [insts];
  let best = null, bestScore = 0;
  for (const p of pool) {
    let score = 0;
    list.forEach((inst, j) => {                 // earlier instruments matter more
      const words = wordsFor(inst);
      words.forEach((w, i) => {
        const wl = w.toLowerCase();
        const s = (list.length - j) * 1000 + (words.length - i) * 10;   // first instrument dominates
        if (p.name.toLowerCase().includes(wl)) score = Math.max(score, s + 5);
        else if (p.cat.toLowerCase().includes(wl)) score = Math.max(score, s);
      });
    });
    const tie = hash(seed + ":" + role + ":" + p.rel) / 4294967296;   // 0..1, stable
    if (score + tie > bestScore) { bestScore = score + tie; best = p; }
  }
  if (bestScore >= 1) return best;
  const fb = pool.filter((p) => FALLBACK_CAT[role].test(p.cat) || FALLBACK_CAT[role].test(p.name));
  const from = fb.length ? fb : pool;
  return from[hash(seed + ":fb:" + role) % from.length];
}

export function choosePresets(index, hints, seed) {
  const h = roleHints(hints);
  const taken = new Set();
  const out = [];
  for (let role = 0; role < 4; role++) {
    const p = pick(index, role, h[role], seed, taken);
    if (p) taken.add(p.rel);
    out.push(p);
  }
  return out;
}

// "Drums/Hybrid/Fabrik Kit.json" -> the presetUri Move writes for it
export const presetUri = (rel) => "ableton:/packs/abl-core-library/Track%20Presets/" +
  rel.split("/").map((s) => encodeURIComponent(s)).join("/");

// ---- 4. the donor Set, rewritten ----------------------------------------------

// ---- the kit's own pads, read from its sample names ------------------------
const LANE_RULES = [
  ["k", /kick|bd\b|bass ?drum/i],
  ["s", /snare|sd\b/i],
  ["c", /clap/i],
  ["o", /hi-?hat.*open|open.*hat|\boh\b/i],
  ["h", /hi-?hat|hat|\bhh\b|\bch\b/i],
  ["p", /rim|stick/i],
  ["r", /ride/i],
  ["x", /crash|cymbal|impact/i],
  ["t", /tom.*(hi|high)|high.*tom/i],
  ["m", /tom.*mid|mid.*tom/i],
  ["l", /tom.*lo|low.*tom|floor/i],
];
const LANE_FALLBACK = { k: 36, s: 38, c: 37, h: 42, o: 46, f: 42, p: 44, r: 49, x: 48, t: 47, m: 47, l: 45 };

export function kitMap(song) {
  const map = {};
  const pads = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.drumZoneSettings && o.drumZoneSettings.receivingNote != null) {
      const uris = JSON.stringify(o).match(/"(?:sampleUri|uri|path)"\s*:\s*"([^"]+)"/g) || [];
      const name = decodeURIComponent((uris[0] || "").split("/").pop().replace(/"$/, ""));
      pads.push({ note: o.drumZoneSettings.receivingNote, name, choke: o.drumZoneSettings.chokeGroup });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(song.tracks[0].devices);
  for (const [lane, re] of LANE_RULES)
    for (const p of pads) if (map[lane] == null && re.test(p.name) && !Object.values(map).includes(p.note)) map[lane] = p.note;
  // toms: any tom fills whichever tom lanes are still open, low to high
  const toms = pads.filter((p) => /tom/i.test(p.name) && !Object.values(map).includes(p.note)).map((p) => p.note);
  for (const lane of ["l", "m", "t"]) if (map[lane] == null && toms.length) map[lane] = toms.shift();
  if (map.f == null) map.f = map.h;
  if (map.p == null) map.p = map.s;
  if (map.r == null) map.r = map.h;
  if (map.x == null) map.x = map.o;
  for (const k of Object.keys(LANE_FALLBACK)) if (map[k] == null) map[k] = map.t || LANE_FALLBACK[k];
  return { map, pads };
}

// ---- instruments ------------------------------------------------------------
// Put a Track Preset (the devicePreset JSON in /data/CoreLibrary/Track Presets)
// on a track in place of its instrument; audio effects after it stay.
export function applyPresets(template, presets) {
  const S = JSON.parse(JSON.stringify(template));
  presets.forEach((pr, t) => {
    if (!pr || !pr.json || !S.tracks[t]) return;
    const { $schema, ...dev } = pr.json;
    const device = Object.assign({ presetUri: pr.uri || null }, dev);
    const devs = S.tracks[t].devices || [];
    const at = devs.findIndex((d) => /rack|instrument|synth|sampler/i.test(d.kind || ""));
    if (at >= 0) devs[at] = device; else devs.unshift(device);
    S.tracks[t].devices = devs;
  });
  return S;
}

// ---- key, scale and meter ---------------------------------------------------
// Move's own scale names, read out of /opt/move/MoveOriginal. Stellate's modes that
// Move has no scale for are sent to the nearest one it does have: hijaz IS phrygian
// dominant; shur and rast are Persian/Arab dastgah-maqam with neutral degrees Move
// cannot tune, so they land on their closest 7-note neighbour; slendro is a gamelan
// pentatonic. The name only drives Move's note layout and pad highlighting -- the
// notes themselves are already written out.
const SCALE = {
  ionian: "Major", major: "Major",
  aeolian: "Minor", minor: "Minor",
  dorian: "Dorian",
  mixo: "Mixolydian", mixolydian: "Mixolydian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  locrian: "Locrian",
  harmonic: "Harmonic Minor", "harmonic minor": "Harmonic Minor",
  melodic: "Melodic Minor", "melodic minor": "Melodic Minor",
  hijaz: "Phrygian Dominant",
  shur: "Phrygian",
  rast: "Mixolydian",
  slendro: "Major Pentatonic",
};
// Every scale name Move knows, read out of /opt/move/MoveOriginal with `strings`. Move does
// NOT validate this field -- a Set claiming "Nonsense Scale" loads -- so move-gate.js gate S
// asserts against this list instead, because nothing else will.
export const MOVE_SCALES = ["Major", "Minor", "Dorian", "Mixolydian", "Lydian", "Phrygian",
  "Locrian", "Whole Tone", "Minor Pentatonic", "Major Pentatonic", "Harmonic Minor",
  "Harmonic Major", "Melodic Minor", "Phrygian Dominant", "Super Locrian", "Lydian Augmented",
  "Dorian #4", "Minor Blues", "Bhairav", "Hungarian Minor", "8-Tone Spanish", "Hirajoshi",
  "In-Sen", "Iwato", "Kumoi", "Chromatic"];

export const scaleOf = (mode) => SCALE[String(mode || "").toLowerCase()] || null;

// Stellate's meter -> Move's time signature. plan.cjs counts the same bar in beats
// ("six" is 6/8, i.e. 3 beats), so the two must agree or the bar lines would not
// line up with the clips.
export function timeSigOf(meter) {
  if (meter === "three") return { upper: 3, lower: 4 };
  if (meter === "six") return { upper: 6, lower: 8 };
  const m = typeof meter === "string" && meter.match(/^(\d+)\/(\d+)$/);
  if (m) return { upper: +m[1], lower: +m[2] };
  return { upper: 4, lower: 4 };
}

// ---- the writer -------------------------------------------------------------
const r6 = (x) => Math.round(x * 1e6) / 1e6;

// Move holds a clip to one sounding note per pitch at a time, and it is strict about it:
// if two notes of the same pitch overlap — or merely meet, one ending exactly where the
// next begins — it refuses the whole Set with "Document invariant violation" on load.
// Stellate writes both: long chord tones ring into later notes of their own pitch, and
// humanising can land two hits on one drum pad a few thousandths of a beat apart. So of
// two onsets too close to tell apart only the louder is kept, and every note is cut to
// fall silent a hair before its own pitch sounds again.
const MIN_DUR = 1 / 32;           // a 1/128 note; two hits closer than this are one hit
const GAP = 1 / 192;              // the silence left between a cut note and the next

export function noOverlaps(notes) {
  const lanes = new Map();
  for (const x of notes) {
    if (!lanes.has(x.n)) lanes.set(x.n, []);
    lanes.get(x.n).push(x);
  }
  const out = [];
  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.t - b.t || b.d - a.d);
    const kept = [];
    for (const x of lane) {
      const last = kept[kept.length - 1];
      if (last && x.t - last.t < MIN_DUR) { if (x.v > last.v) kept[kept.length - 1] = x; }
      else kept.push(x);
    }
    kept.forEach((x, i) => {
      if (i + 1 === kept.length) { out.push(x); return; }
      const room = r6(kept[i + 1].t - x.t - GAP);
      out.push(x.d <= room ? x : { ...x, d: room });
    });
  }
  return out.sort((a, b) => a.t - b.t || a.n - b.n);
}

const TRACK_NAMES = ["Drums", "Bass", "Keys", "Lead"];

export function writeSet(template, song, plan) {
  const S = JSON.parse(JSON.stringify(template));
  S.tempo = Math.round(song.bpm * 100) / 100;
  if (Number.isFinite(song.key)) S.rootNote = ((Math.round(song.key) % 12) + 12) % 12;
  const sc = scaleOf(song.mode);
  if (sc) S.scale = sc;
  S.timeSignature = timeSigOf(song.meter);

  S.tracks.forEach((track, t) => {
    track.isSelected = t === 0;
    if (TRACK_NAMES[t]) track.name = TRACK_NAMES[t];
    // a fresh start: every track audible, nothing soloed (a template's mute or
    // solo would otherwise leave you hearing one track)
    if (track.mixer) { track.mixer.speakerOn = true; track.mixer["solo-cue"] = false; }
    track.clipSlots = track.clipSlots.map((slot, c) => {
      const clip = plan.columns[t] && plan.columns[t][c];
      if (!clip) return { hasStop: true, clip: null };
      const beats = clip.beats;
      const out = {
        isPlaying: c === 0,             // Play starts the first scene on every track
        name: (plan.scenes[c] && plan.scenes[c].name) || "",
        color: track.color,
        isEnabled: true,
        region: { start: 0.0, end: beats, loop: { start: 0.0, end: beats, isEnabled: true } },
        // Stellate humanises its own timing; inheriting the template's groove would
        // swing it a second time wherever the base Set has a groove amount set.
        grooveId: null,
        stepEditorScrollPosition: 0.0,
        // Move's noteNumber is an integer; a few genres (dastgah, gamelan…) compose in
        // quarter tones, which Move has no way to hold, so they land on the nearest key.
        notes: noOverlaps(clip.notes.map((x) => ({ n: Math.round(x.n), t: r6(x.t), d: r6(x.d), v: x.v })))
          .map((x) => ({ noteNumber: x.n, startTime: x.t, duration: x.d,
                         velocity: x.v, offVelocity: 0.0 })),
        envelopes: [],
      };
      return { hasStop: true, clip: out };
    });
  });
  S.scenes = S.scenes.map((sc, c) => ({ name: (plan.scenes[c] && plan.scenes[c].name) || "", color: sc.color }));

  const songMode = {
    entries: plan.entries.map((e) => ({ pads: e.pads, repeats: e.repeats, barLengthMode: e.mode, customBars: e.customBars })),
    tailBars: 0,
  };
  return { song: S, songMode };
}
// ---- 5. the one call ----------------------------------------------------------
// ns    the nukernel tier: { NG, K, Doc, P, wiki } (tools/move/nukernel-node.mjs in node,
//       window.Nu* in the page)
// donor a Set Move saved, parsed: 4 tracks x 8 clip slots, a drum kit on track 1
// picks null to keep the donor's own instruments, or
//       { index: [{rel,name,cat}], load(rel) -> devicePreset JSON|null } to swap in
//       core-library Track Presets for the genre
export function moveSet(ns, donor, key, seed, picks = null) {
  const S = sections(ns);
  let template = donor, chosen = [null, null, null, null];
  if (picks && picks.index && picks.index.length) {
    chosen = choosePresets(picks.index, S.instrumentsOf(key, seed), seed);
    const loaded = chosen.map((p) => {
      if (!p) return null;
      const json = picks.load(p.rel);
      return json && json.chains ? { json, uri: presetUri(p.rel) } : null;
    });
    if (!loaded[0] && !hasKit(donor)) throw new Error("no drum kit available");
    template = applyPresets(donor, loaded);
  } else if (!hasKit(donor)) {
    throw new Error("the donor's first track has no drum kit");
  }
  const kit = kitMap(template);
  const song = S.songSections(key, seed, kit.map);
  const p = plan(song);
  const { song: abl, songMode } = writeSet(template, song, p);
  return {
    name: (song.title + " #" + seed).replace(/[\/\\:*?"<>|]/g, "-"),
    song: abl, songMode, plan: p, composed: song, kit,
    sounds: template.tracks.map((t) => (t.devices.find((d) => d.chains) || t.devices[0] || {}).name || "?"),
    picked: chosen.map((c) => (c ? c.rel : null)),
  };
}

// A donor is only usable if its first track carries a kit for the drum map to read.
export const hasKit = (t) => JSON.stringify(t.tracks[0].devices || []).indexOf("drumZoneSettings") >= 0;

// 4 tracks x 8 slots is the shape every Move Set has, and all this code assumes it.
export function donorOk(t) {
  try {
    return !!t && Array.isArray(t.tracks) && t.tracks.length === 4 &&
      t.tracks.every((tr) => Array.isArray(tr.clipSlots) && tr.clipSlots.length === 8 && Array.isArray(tr.devices));
  } catch (e) { return false; }
}
