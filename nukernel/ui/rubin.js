// ui/rubin.js — RUBINESQUE, the couch. The producer aims at the SONG or at
// one SECTION (the graph row), assembles a sentence by tapping words (the
// tray offers only words that still compile — rubin-lang's exactness law),
// speaks it by tapping the sentence, and the engineer moves the one real
// writer each effect names: the board's offset layer, the section's own
// fields, the ops list, the tempo. Up to five standing commands per node,
// each retractable (tap it in the ledger). WRITE or a load clears the couch —
// the words were about that record.
import { parse, continuations, describeFx, MAX_CMDS, LEXICON } from "./rubin-lang.js";
import { SONG, SLOTS, bpm, setBpm, on, emit, commit, MIXER, setMixOffset, adoptSong,
         POOL, setPoolChair, setGroove, setSwing, GROOVE, SWING } from "./state.js";
import { NuFields, GENRES, DRUMKITS, BASS_INSTR, BASSSYNTH, partChairLabel,
         NuSong, MAX_FX } from "./deps.js";
import { partKeysOf, voiceRoster } from "../audio/desk.js";
import { gid, voiceOwners, kitOf, genreOf, stackOf } from "./derive.js";
import { isSynthFont, fontDef } from "../audio/fonts.js";
import { playing as transportOn, playingSec } from "../audio/live.js";

const $ = (id) => document.getElementById(id);
const wrap = $("rubinwrap");

/* ---------- the aim: song, or one section ---------- */
let aim = { scope: "song", si: -1 };
let tokens = [];
// THE PINNED TRACK. "When I click on a track I should be able to tap in a
// sentence that applies to just that track": clicking a seat in the band
// pins its subject, so the sentence is VERB + HOW — two taps — and the
// subject word is filled in for you.
let pinned = null;                     // the subject word, e.g. "bass"
const PINWORD = { bass: "bass", drums: "drums", pad: "pad", pad2: "pad",
                  lead: "melody", line: "melody", line2: "melody", line3: "melody",
                  riff: "melody", counter: "melody", stab: "melody", drone: "pad" };
const pinFor = (seat) => PINWORD[seat.key] || PINWORD[seat.part] || null;
let ledger = { song: [], secs: {} };       // node -> [{text, fx, prev}]
const nodeCmds = () => aim.scope === "song" ? ledger.song
  : (ledger.secs[aim.si] = ledger.secs[aim.si] || []);
const secOf = () => SONG[aim.si];

/* ---------- the apply layer: one writer per effect shape ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SENDORDER = Object.keys(NuFields.SENDS);
const offOf = (chan, key) => (MIXER && MIXER[chan] && MIXER[chan][key]) || 0;
const eqOffOf = (chan, band) => (MIXER && MIXER[chan] && MIXER[chan].eq && MIXER[chan].eq[band]) || 0;
const writeMixEq = (chan, band, v) => {
  const eq = { ...((MIXER && MIXER[chan] && MIXER[chan].eq) || {}) };
  if (v) eq[band] = clamp(v, -12, 12); else delete eq[band];
  setMixOffset(chan, "eq", Object.keys(eq).length ? eq : null);
};
function applyOne(e) {
  const sec = secOf();
  switch (e.t) {
    case "mix": {
      const prev = offOf(e.chan, e.key);
      setMixOffset(e.chan, e.key, clamp(prev + e.delta, e.key === "fader" ? -24 : -1,
                                        e.key === "fader" ? 12 : 1) || null);
      return { undo: () => setMixOffset(e.chan, e.key, prev || null) };
    }
    case "mixeq": {
      const prev = eqOffOf(e.chan, e.band);
      writeMixEq(e.chan, e.band, prev + e.delta);
      return { undo: () => writeMixEq(e.chan, e.band, prev) };
    }
    case "bpm": {
      const prev = bpm;
      setBpm(clamp(bpm + e.delta, 70, 160));
      $("bpm").value = bpm; $("bpmv").textContent = String(bpm);
      commit("transport");
      return { undo: () => { setBpm(prev); $("bpm").value = prev;
        $("bpmv").textContent = String(prev); commit("transport"); } };
    }
    case "secnum": {
      const prev = sec[e.key];
      sec[e.key] = clamp((sec[e.key] || 0) + e.delta, -24, 12);
      commit("box");
      return { undo: () => { if (prev == null) delete sec[e.key]; else sec[e.key] = prev; commit("box"); } };
    }
    case "seceq": {
      const prev = sec.eq ? { ...sec.eq } : null;
      const eq = { ...(sec.eq || {}) };
      const v = clamp((eq[e.band] || 0) + e.delta, -12, 12);
      if (v) eq[e.band] = v; else delete eq[e.band];
      if (Object.keys(eq).length) sec.eq = eq; else delete sec.eq;
      commit("box");
      return { undo: () => { if (prev) sec.eq = prev; else delete sec.eq; commit("box"); } };
    }
    case "secsend": {
      const key = e.key;                    // "rev" | "echo"
      const prev = sec[key];
      const idx = SENDORDER.indexOf(sec[key]);
      const next = SENDORDER[clamp((idx < 0 ? 1 : idx) + e.step, 0, SENDORDER.length - 1)];
      sec[key] = next; commit("box");
      return { undo: () => { if (prev == null) delete sec[key]; else sec[key] = prev; commit("box"); } };
    }
    case "seckit": case "secmot": case "secper": {
      const F = { seckit: "kit", secmot: "mot", secper: "period" }[e.t];
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b[F]);
      for (const b of targets) b[F] = e.word;
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { if (prev[i] == null) delete b[F];
        else b[F] = prev[i]; }); commit("box"); } };
    }
    case "drums": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prevKits = targets.map(b => b.kit);
      const prevMute = !!(MIXER && MIXER.drums && MIXER.drums.mute);
      if (e.on) {
        for (const b of targets) {
          const kitted = Object.keys((GENRES[gid(b)] || {}).kit || {}).length > 0;
          if (!kitted) b.kit = "four";            // the kit word that INVENTS lanes:
                                                  // drums for a genre that never had any
          else if (b.kit === "nodrums") delete b.kit;
        }
        setMixOffset("drums", "mute", null);      // the other door drums leave through
      } else for (const b of targets) b.kit = "nodrums";
      commit("box");
      return { undo: () => {
        targets.forEach((b, i) => { if (prevKits[i] == null) delete b.kit; else b.kit = prevKits[i]; });
        if (e.on && prevMute) setMixOffset("drums", "mute", true);
        commit("box");
      } };
    }
    case "pipes": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b.pipes);
      for (const b of targets) { if (e.set === "off") delete b.pipes; else b.pipes = e.set; }
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { if (prev[i] == null) delete b.pipes;
        else b.pipes = prev[i]; }); commit("box"); } };
    }
    case "oct": {
      // the BASS has its own register (fields.js boct — the line's `oct`
      // never reached it, which is why "make bass an octave higher" moved
      // every line and left the bass alone); everything else moves the lines
      const F = e.what === "bass" ? "boct" : "oct";
      const targets = aim.scope === "song" ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b[F]);
      for (const b of targets) {
        const at = clamp((+b[F] || 0) + e.by, -2, 2);
        if (at) b[F] = String(at); else delete b[F];
      }
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { if (prev[i] == null) delete b[F];
        else b[F] = prev[i]; }); commit("box"); } };
    }
    case "insert": {
      // a new section, cloned from its neighbour so it keeps the record's own
      // genre and phrase, then given its role (and its player, for a solo)
      if (SONG.length >= 16) return { undo: () => {} };
      const at = aim.scope === "song" ? SONG.length - 1 : aim.si;
      const src = SONG[Math.max(0, at)] || SONG[0];
      const box = JSON.parse(JSON.stringify(src));
      box.role = e.role; box.cue = e.role;
      if (e.canon === "solo" && !box.stack.some(x => x.g === "solo")) {
        const sl = (box.stack[0].slots || []).slice(0, 1);
        box.stack.push({ g: "solo", slots: sl.length ? sl : [0] });
      }
      SONG.splice(at + 1, 0, box);
      commit("box"); emit("selection", {});
      return { undo: () => { const i = SONG.indexOf(box); if (i >= 0) SONG.splice(i, 1);
        commit("box"); emit("selection", {}); } };
    }
    case "drop": {
      const gone = [];
      for (let i = SONG.length - 1; i >= 0 && SONG.length > 1; i--)
        if ((SONG[i].cue || SONG[i].role) === e.role) gone.push([i, SONG.splice(i, 1)[0]]);
      commit("box"); emit("selection", {});
      return { undo: () => { for (const [i, b] of gone.reverse()) SONG.splice(i, 0, b);
        commit("box"); emit("selection", {}); } };
    }
    case "secfx": {
      const hit = SONG.filter(b => (b.cue || b.role) === e.role);
      const prev = hit.map(b => (b.fx || []).slice());
      for (const b of hit) {
        const fx = (b.fx || []).filter(x => x !== e.chip);
        if (e.on) fx.push(e.chip);
        b.fx = fx.slice(0, MAX_FX);
        if (!b.fx.length) delete b.fx;
      }
      commit("box");
      return { undo: () => { hit.forEach((b, i) => { if (prev[i].length) b.fx = prev[i];
        else delete b.fx; }); commit("box"); } };
    }
    case "hire": {
      // THE COUCH BUILDS A BAND. A part arrives as a stacked FUNCTION genre
      // (they exist for exactly this: one voice, no kit, no prog, written to
      // be stacked) and the instrument is CAST onto the chair it takes.
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b.stack.map(x => ({ ...x, slots: [...(x.slots || [])] })));
      const prevBass = targets.map(b => b.bassop);
      const prevPool = POOL ? { ...POOL } : null;
      // WHICH PLAYER ARRIVES. Every FUNCTION genre already IS an instrument
      // (simple is a grand piano, riff a muted guitar, vocal a singer, backing
      // a choir, pad a warm pad), so a request for one of those hires the
      // genre that already plays it and no cast is needed; anything else
      // stacks the plain line and the pool casts the chair it takes.
      const BYINST = { piano: "simple", guitar: "riff", vocals: "vocal",
                       choir: "backing", chords: "pad" };
      const FN = { melody: "solo", chords: "pad", vocals: "vocal" };
      const g = BYINST[e.what] || FN[e.part];
      const needCast = !BYINST[e.what] && !!e.id;
      for (const b of targets) {
        if (e.part === "bass") { b.bassop = "walk"; continue; }
        // only the LAYERS are checked for a duplicate: on a record whose
        // AUTHORITY is the same function genre (a from-nothing record is
        // `simple`, which is a grand piano) the hire was silently skipped
        if (!g || b.stack.slice(1).some(x => x.g === g)) continue;
        const slots = (b.stack[0].slots || []).slice(0, 1);
        b.stack.push({ g, slots: slots.length ? slots : [0] });
      }
      // the new chair takes the named instrument (the pool is the record's)
      if (needCast && targets[0]) {
        const r = rosterOf(targets[0]);
        const seat = r.filter(x => x.part && x.part !== "drums").pop();
        if (seat) setPoolChair(seat.part, e.id);
      }
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { b.stack = prev[i];
          if (prevBass[i] == null) delete b.bassop; else b.bassop = prevBass[i]; });
        if (e.id) for (const c of Object.keys(POOL || {}))
          setPoolChair(c, prevPool ? prevPool[c] || null : null);
        commit("box"); } };
    }
    case "fire": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b.stack.map(x => ({ ...x, slots: [...(x.slots || [])] })));
      const prevBass = targets.map(b => b.bassop);
      const FN = { melody: ["solo", "riff", "simple"], chords: ["pad"], vocals: ["vocal", "backing"] };
      for (const b of targets) {
        if (e.part === "bass") { b.bassop = "nobass"; continue; }
        const drop = FN[e.part] || [];
        b.stack = [b.stack[0], ...b.stack.slice(1).filter(x => !drop.includes(x.g))];
        if (b.focus != null) b.focus = Math.min(b.focus, b.stack.length - 1);
      }
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { b.stack = prev[i];
        if (prevBass[i] == null) delete b.bassop; else b.bassop = prevBass[i]; }); commit("box"); } };
    }
    case "secbass": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b.bassop);
      for (const b of targets) b.bassop = e.op;
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { if (prev[i] == null) delete b.bassop;
        else b.bassop = prev[i]; }); commit("box"); } };
    }
    case "groove": { const prev = GROOVE; setGroove(e.word); commit("groove");
      return { undo: () => { setGroove(prev); commit("groove"); } }; }
    case "swing": { const prev = SWING; setSwing(e.word); commit("swing");
      return { undo: () => { setSwing(prev); commit("swing"); } }; }
    case "fx": {
      const prev = (MIXER && MIXER[e.chan] && MIXER[e.chan].fx) || null;
      const next = e.on ? [...new Set([...(prev || []), e.chip])]
                        : (prev || []).filter(x => x !== e.chip);
      setMixOffset(e.chan, "fx", next.length ? next : null);
      return { undo: () => setMixOffset(e.chan, "fx", prev && prev.length ? prev : null) };
    }
    case "cast": {
      const prev = e.chairs.map(c => (POOL && POOL[c]) || null);
      for (const c of e.chairs) setPoolChair(c, e.id);
      return { undo: () => e.chairs.forEach((c, i) => setPoolChair(c, prev[i])) };
    }
    case "redo": {
      // the next phrase in the bank, for whatever this node aims at: the
      // material changes, nothing about the mix does
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prev = targets.map(b => b.stack.map(x => ({ ...x, slots: [...(x.slots || [])] })));
      const n = SLOTS.length;
      for (const b of targets)
        for (const st of b.stack)
          if (st.slots && st.slots.length)
            st.slots = st.slots.map(i => (i + 1) % Math.max(1, n));
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { b.stack = prev[i]; }); commit("box"); } };
    }
    case "think": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      const prevStacks = targets.map(b => b.stack.map(x => ({ ...x, slots: [...(x.slots || [])] })));
      if (e.on) {
        for (const b of targets) {
          if (b.stack.slice(1).some(x => x.g === e.g)) continue;
          const slots = (b.stack[0].slots || []).slice(0, 1);
          b.stack.push({ g: e.g, slots: slots.length ? slots : [0] });
        }
      } else for (const b of targets) {
        b.stack = [b.stack[0], ...b.stack.slice(1).filter(x => x.g !== e.g)];
        if (b.focus != null) b.focus = Math.min(b.focus, b.stack.length - 1);
      }
      commit("box");
      return { undo: () => { targets.forEach((b, i) => { b.stack = prevStacks[i];
        if (b.focus != null) b.focus = Math.min(b.focus, b.stack.length - 1); }); commit("box"); } };
    }
    case "ops": {
      const targets = aim.scope === "song"
        ? SONG.slice() : [secOf()].filter(Boolean);
      for (const b of targets) b.ops = [...(b.ops || []), e.add];
      commit("box");
      return { undo: () => { for (const b of targets) {
        const i = (b.ops || []).lastIndexOf(e.add);
        if (i >= 0) { b.ops = b.ops.slice(0, i).concat(b.ops.slice(i + 1)); if (!b.ops.length) delete b.ops; }
      } commit("box"); } };
    }
  }
  return { undo: () => {} };
}
// A SPOKEN SENTENCE HAS A DOSE. "Once you've written a sentence add a button
// beside it for more and for less": a command is not a switch, it is an
// amount, so every ledger row keeps a STACK of applications — + says it again
// (the deltas add), − takes the last one back, and the row empties into
// nothing. A sentence whose effects are one-shot (a chip, a recast, a layer)
// has no + : saying it twice would say it once.
const DOSABLE = new Set(["mix", "mixeq", "bpm", "secnum", "seceq", "secsend", "ops", "redo"]);
const dosable = (fx) => fx.every(e => DOSABLE.has(e.t));
function speak(p) {
  const cmds = nodeCmds();
  if (cmds.length >= MAX_CMDS) return;      // the tray already said so
  const cmd = { text: p.text, fx: p.fx, scope: aim.scope, node: aim.si,
                did: describeFx(p.fx, aim.scope), doses: [], dosable: dosable(p.fx) };
  cmds.push(cmd);
  more(cmd);                                 // the first dose IS the sentence
  tokens = [];
  draw();                                     // the pin stays: say another thing about it
}
// say it again. The apply layer is aimed at the node that spoke, so a dose
// added while looking elsewhere still lands where the words were said.
function more(cmd) {
  if (cmd.doses.length && !cmd.dosable) return;
  const held = aim;
  aim = { scope: cmd.scope, si: cmd.node };
  try { cmd.doses.push(cmd.fx.map(applyOne)); } finally { aim = held; }
  draw();
}
// take one back; the last one takes the sentence with it
function less(cmd) {
  const undos = cmd.doses.pop();
  if (undos) for (const u of [...undos].reverse()) { try { u.undo(); } catch (e) { /* held */ } }
  if (!cmd.doses.length) {
    const cmds = aim.scope === cmd.scope && aim.si === cmd.node ? nodeCmds()
      : (cmd.scope === "song" ? ledger.song : (ledger.secs[cmd.node] || []));
    const i = cmds.indexOf(cmd);
    if (i >= 0) cmds.splice(i, 1);
  }
  draw();
}
function retract(cmd) {
  while (cmd.doses.length) less(cmd);
}

/* ---------- WHO IS IN THE BAND, role by role ------------------------------
   "Show me little indicators for all the track roles and what's in them.
   Melody: Piano, Pads: Strings" — and it is the same question the grammar
   asks (a chair nobody sits in is not a subject), so one reader answers
   both: the panel prints it and ctxOf() below keys the language on it. */
const humanize = (id) => String(id || "").replace(/_/g, " ");
function soundOf(g, r) {
  const syn = isSynthFont() ? fontDef().synth : (r.over ? null : (g && g.synth));
  const useSyn = syn && !(syn.lineOnly && r.pad && !isSynthFont());
  return useSyn ? (syn.root || syn.dsp) : humanize(r.id);
}
function rosterOf(sec) {
  if (!sec) return [];
  let roster = [], owners = [], keys = [];
  try { roster = voiceRoster(sec); owners = voiceOwners(sec); keys = partKeysOf(sec, roster); }
  catch (e) { return []; }
  // WHICH VOICES ACTUALLY SOUND: a stack entry with no phrase is a player
  // holding an instrument and no part, so it is not in the room. This is what
  // lets a record start from NOTHING and fill up as the couch hires.
  const live = [];
  for (const ent of stackOf(sec)) {
    const g = GENRES[ent.g];
    for (let v = 0; v < ((g && g.voices) || 0); v++) live.push(!!(ent.slots && ent.slots.length));
  }
  const out = roster.map((r, i) => ({ key: r.key, role: partChairLabel(r.key),
    sound: soundOf(GENRES[owners[i]], r), pad: r.pad, part: r.part,
    silent: live[i] === false }))
    .filter(r => !r.silent);
  if (keys.includes("bass")) {
    const bs = BASSSYNTH[sec.bassop];
    out.push({ key: "bass", role: partChairLabel("bass"), part: "bass",
      sound: bs ? (bs.root || bs.dsp) : humanize((POOL && POOL.bass) || BASS_INSTR) });
  }
  if (keys.includes("drums")) {
    const k = kitOf(sec);
    out.push({ key: "drums", role: partChairLabel("drums"), part: "drums",
      sound: DRUMKITS[k] || k || "drums" });
  }
  return out;
}

/* ---------- the record's facts, for the state-aware grammar ---------- */
// what the aimed node actually HAS — the language refuses sentences about
// anything else ("align the grammar with the state of the song")
function ctxOf() {
  const secs = aim.scope === "song" ? SONG.slice() : [secOf()].filter(Boolean);
  const facts = { drumsOn: false, drumsOff: false,
    parts: { bass: false, melody: false, chords: false, vocals: false },
    insts: {}, fx: {},
    rev: 1, revMax: SENDORDER.length - 1, echo: 1, echoMax: SENDORDER.length - 1,
    stacked: {}, sections: {} };
  for (const sec of secs) {
    facts.sections[sec.cue || sec.role || "section"] = true;
    const g = GENRES[gid(sec)] || {};
    // the RESOLVED kit, not the anchor's: a kit word can invent lanes on a
    // genre that never had any (that is what ADD DRUMS does), and a ctx that
    // read the anchor kept refusing every drum sentence afterwards
    let rk = g.kit || {};
    try { rk = genreOf(sec).kit || {}; } catch (e) { /* the anchor's, then */ }
    const has = Object.keys(rk).length > 0 && sec.kit !== "nodrums";
    if (has) facts.drumsOn = true;
    if (!has) facts.drumsOff = true;         // missing OR never-had: ADD invents (kit "four")
    let keys = [];
    try { keys = partKeysOf(sec); } catch (e) { /* an empty box has no parts */ }
    for (const k of keys) {
      if (k === "bass") facts.parts.bass = true;
      else if (k.startsWith("pad")) facts.parts.chords = true;
      else if (k !== "drums") facts.parts.melody = true;
    }
    // ...and what is actually SITTING in those chairs, which is what makes
    // "add echo to melody" mean something you can predict
    for (const r of rosterOf(sec)) {
      const t = String(r.sound || "");
      if (/guitar/.test(t)) facts.insts.guitar = true;
      if (/piano|clav|rhodes|wurl/.test(t)) facts.insts.piano = true;
      if (/organ/.test(t)) facts.insts.organ = true;
      if (/string|violin|cello|ensemble/.test(t)) facts.insts.strings = true;
      if (/trumpet|brass|sax|horn|trombone|tuba/.test(t)) facts.insts.horns = true;
      if (/bell|celesta|glocken|vibraphone|marimba|music box/.test(t)) facts.insts.bells = true;
      if (/voice|choir|vox|voices/.test(t)) facts.parts.vocals = true;
    }
    for (const x of (sec.stack || []).slice(1)) {
      facts.stacked[x.g] = true;
      if (x.g === "vocal" || x.g === "backing" || x.as === "voice") facts.parts.vocals = true;
    }
    // (the genre's DECLARED cast is not read here: a from-nothing record's
    // authority declares a grand piano and plays nothing, and counting it
    // made ADD PIANO mean "louder piano" on a silent record. Only the
    // sounding roster below counts.)
  }
  // the board's standing chips, per chan — so a chip already on cannot be
  // added twice and one that is not on cannot be cut
  for (const [chan, o] of Object.entries(MIXER || {}))
    if (o && o.fx) { facts.fx[chan] = {}; for (const c of o.fx) facts.fx[chan][c] = true; }
  if (aim.scope !== "song" && secs[0]) {
    const i = SENDORDER.indexOf(secs[0].rev); facts.rev = i < 0 ? 1 : i;
    const j = SENDORDER.indexOf(secs[0].echo); facts.echo = j < 0 ? 1 : j;
  }
  return facts;
}

/* ---------- draw ---------- */
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
// A RECORD THAT STARTS FROM NOTHING. Four sections on the plainest authority
// the table has, carrying NO phrase — so nothing sounds, nobody is in the
// room, and every sentence the couch says is a hire. The bank rides along so
// a hired player has something to play.
function startFromNothing() {
  const slots = JSON.parse(JSON.stringify(SLOTS.length ? SLOTS : [NuSong.blank()]));
  const song = Array.from({ length: 4 }, () => ({
    ...NuSong.emptyBox(), stack: [{ g: "simple", slots: [] }] }));
  adoptSong({ v: NuSong.VERSION, slots, song, bpm, genres: {} }, "nothing");
}

export function draw() {
  if (!wrap) return;
  wrap.textContent = "";
  // THE GRAPH: the song node, then one node per playing section
  const graph = el("div", "rgraph");
  const node = (label, scope, si) => {
    const live = transportOn && si >= 0 && si === playingSec;
    const n = el("button", "rnode" + ((aim.scope === scope && aim.si === si) ? " on" : "")
      + (live ? " live" : ""));
    n.type = "button";
    const cmds = scope === "song" ? ledger.song : (ledger.secs[si] || []);
    n.append(el("span", "rl", label), el("span", "rn", cmds.length ? cmds.length + "/" + MAX_CMDS : ""));
    n.addEventListener("click", () => { aim = { scope, si }; tokens = []; draw(); });
    return n;
  };
  graph.append(node("THE SONG", "song", -1));
  {
    const z = el("button", "rnothing", "start from nothing");
    z.type = "button";
    z.title = "an empty record: no players, no parts — build it by saying things";
    z.addEventListener("click", startFromNothing);
    graph.append(z);
  }
  SONG.forEach((b, i) => graph.append(
    node((i + 1) + " " + (b.cue || b.role || "section"), "section", i)));
  wrap.append(graph);

  // THE BAND, ROLE BY ROLE — of the section sounding, or the one aimed at.
  // "Melody: Piano, Pads: Strings": you cannot direct a player you cannot
  // see, and the panel and the grammar read the same roster.
  {
    const shown = (transportOn && playingSec >= 0 && SONG[playingSec]) ? SONG[playingSec]
      : (aim.scope === "section" ? secOf() : SONG[0]);
    const band = rosterOf(shown);
    const strip = el("div", "rband");
    strip.append(el("i", "rg", (transportOn && playingSec >= 0
      ? "playing · " + (SONG[playingSec].cue || SONG[playingSec].role || "section") : "the band")));
    if (!band.length) strip.append(el("span", "rseat", "nobody yet — say ADD DRUMS, ADD BASS, ADD PIANO"));
    for (const r of band) {
      const w = pinFor(r);
      const seat = el(w ? "button" : "span", "rseat" + (w && pinned === w ? " on" : ""));
      if (w) { seat.type = "button"; seat.title = "say something about just this track";
        seat.addEventListener("click", () => {
          pinned = pinned === w ? null : w; tokens = []; draw(); }); }
      seat.append(el("b", null, r.role), document.createTextNode(" " + r.sound));
      strip.append(seat);
    }
    wrap.append(strip);
  }

  // THE SENTENCE: what has been tapped; tap it to speak when it compiles
  const scope = aim.scope;
  const ctx = ctxOf();
  const p = tokens.length ? parse(tokens, scope, ctx) : null;
  const sent = el("div", "rsent" + (p ? " ok" : ""));
  if (pinned) {
    const pin = el("button", "rpin", pinned.toUpperCase() + " ✕");
    pin.type = "button"; pin.title = "stop talking about just this track";
    pin.addEventListener("click", () => { pinned = null; tokens = []; draw(); });
    sent.append(pin);
  }
  sent.append(el("span", "rwords", tokens.length ? tokens.join(" ").toUpperCase()
    : pinned ? "SAY SOMETHING ABOUT THE " + pinned.toUpperCase() : "SAY SOMETHING"));
  if (p) {
    const go = el("button", "rgo", "SAY IT");
    go.type = "button";
    go.addEventListener("click", () => speak(p));
    sent.append(go);
  }
  // ...and what it would MOVE, said before it is said ("show me what it
  // translated to"): the compiled effects in the engineer's own words
  if (p) wrap.append(Object.assign(el("div", "rdid"),
    { textContent: "→ " + describeFx(p.fx, scope) }));
  if (tokens.length) {
    const x = el("button", "rclear", "✕");
    x.type = "button";
    x.addEventListener("click", () => { tokens = []; draw(); });
    sent.append(x);
  }
  wrap.append(sent);

  // THE TRAY: only words that still work exactly — and nothing at the cap
  const tray = el("div", "rtray");
  if (nodeCmds().length >= MAX_CMDS)
    tray.append(el("div", "rfull", "this " + (scope === "song" ? "record" : "section") +
      " has heard " + MAX_CMDS + " things — take one back to say more"));
  else {
    const next = continuations(tokens, scope, ctx);
    // ONE CHIP PER MEANING ("get rid of options I shouldn't click"): the
    // language holds every synonym, but a tray that offers "delay" and "the
    // delay" side by side is one thought twice. Each canon shows its first
    // form — the lexicon lists are authored best-form-first.
    const oneEach = (role) => {
      const seen = new Set(), out = [];
      const synsOf = (T) => Object.fromEntries(Object.entries(T).map(([k, g]) => [k, g.syns]));
      const table = role === "verb" ? LEXICON.V : role === "subj" ? LEXICON.S
        : role === "unit" ? synsOf(LEXICON.U) : role === "inst" ? synsOf(LEXICON.I)
        : role === "gen" ? synsOf(LEXICON.G) : role === "fxadj" ? synsOf(LEXICON.FXA)
        : role === "fxn" ? LEXICON.FXN
        : role === "on" ? Object.fromEntries(Object.keys(LEXICON.ONWORD).map(w => [w, [w]]))
        : role === "give" ? synsOf(LEXICON.GIVE) : role === "sect" ? synsOf(LEXICON.SEC)
        : role === "bassadj" ? LEXICON.BASSWORD : role === "kitadj" ? LEXICON.KITWORD
        : role === "feeladj" ? LEXICON.FEELSYN
        : LEXICON.A;
      for (const [canon, syns] of Object.entries(table)) {
        const w = syns.find(x => next.has(x));
        if (w && !seen.has(canon)) { seen.add(canon); out.push(syns[0] !== w && next.has(syns[0]) ? syns[0] : w); }
      }
      return out;
    };
    const groups = [["say", "verb"], ["about", "subj"], ["about", "unit"],
                    ["about", "inst"], ["give it", "give"], ["a section", "sect"],
                    ["like", "gen"], ["how", "adj"],
                    ["how to play", "bassadj"], ["how to play", "kitadj"],
                    ["the feel", "feeladj"], ["how", "fxadj"],
                    ["effect", "fxn"], ["on what", "on"]];
    for (const [label, role] of groups) {
      const words = oneEach(role);
      if (!words.length) continue;
      const g = el("div", "rgroup");
      g.append(el("i", "rg", label));
      for (const w of words) {
        const c = el("button", "rchip", w);
        c.type = "button";
        c.addEventListener("click", () => {
          tokens = [...tokens, w];
          // the pinned track IS the subject: the verb brings it along, so a
          // sentence about one player is VERB + HOW
          if (pinned && tokens.length === 1 && LEXICON.WORDS[w].role === "verb") {
            const two = [w, pinned];
            if (parse(two, scope, ctx) || continuations(two, scope, ctx).size)
              tokens = two;
          }
          const c2 = ctxOf();
          const done = parse(tokens, scope, c2);
          if (done && !continuations(tokens, scope, c2).size) speak(done);
          else draw();
        });
        g.append(c);
      }
      tray.append(g);
    }
  }
  wrap.append(tray);

  // THE LEDGER: what this node has been told; tap to retract
  const cmds = nodeCmds();
  if (cmds.length) {
    const lg = el("div", "rledger");
    lg.append(el("i", "rg", "standing"));
    for (const c of cmds) {
      const row = el("div", "rcmdrow");
      const said = el("button", "rcmd");
      said.type = "button";
      said.title = "tap to take it back";
      said.append(el("b", "rct", c.text + (c.doses.length > 1 ? "  ×" + c.doses.length : "")),
                  el("span", "rdid", "→ " + (c.did || "")));
      said.addEventListener("click", () => retract(c));
      row.append(said);
      // THE DOSE KEYS, beside the sentence
      const dn = el("button", "rdose", "−");
      dn.type = "button"; dn.title = "less of that";
      dn.addEventListener("click", (ev) => { ev.stopPropagation(); less(c); });
      row.append(dn);
      if (c.dosable) {
        const up = el("button", "rdose", "+");
        up.type = "button"; up.title = "more of that";
        up.addEventListener("click", (ev) => { ev.stopPropagation(); more(c); });
        row.append(up);
      }
      lg.append(row);
    }
    wrap.append(lg);
  }
}

/* ---------- the couch resets with the record ---------- */
on("song", () => { ledger = { song: [], secs: {} }; tokens = []; pinned = null;
  aim = { scope: "song", si: -1 }; draw(); });
// the grammar reads the record, so the tray re-reads it when the record moves
on("box", draw);
on("mix", draw);
on("pool", draw);
on("groove", draw);
on("swing", draw);
on("transport:section", draw);      // the playhead moved: relight the graph
on("transport:state", draw);
draw();
