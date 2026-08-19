// ui/rubin.js — RUBINESQUE, the couch. The producer aims at the SONG or at
// one SECTION (the graph row), assembles a sentence by tapping words (the
// tray offers only words that still compile — rubin-lang's exactness law),
// speaks it by tapping the sentence, and the engineer moves the one real
// writer each effect names: the board's offset layer, the section's own
// fields, the ops list, the tempo. Up to five standing commands per node,
// each retractable (tap it in the ledger). WRITE or a load clears the couch —
// the words were about that record.
import { parse, continuations, describeFx, MAX_CMDS, LEXICON } from "./rubin-lang.js";
import { SONG, bpm, setBpm, on, emit, commit, MIXER, setMixOffset } from "./state.js";
import { NuFields, GENRES } from "./deps.js";
import { partKeysOf } from "../audio/desk.js";
import { gid } from "./derive.js";

const $ = (id) => document.getElementById(id);
const wrap = $("rubinwrap");

/* ---------- the aim: song, or one section ---------- */
let aim = { scope: "song", si: -1 };
let tokens = [];
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
    case "seckit": { const prev = sec.kit; sec.kit = e.word; commit("box");
      return { undo: () => { if (prev == null) delete sec.kit; else sec.kit = prev; commit("box"); } }; }
    case "secmot": { const prev = sec.mot; sec.mot = e.word; commit("box");
      return { undo: () => { if (prev == null) delete sec.mot; else sec.mot = prev; commit("box"); } }; }
    case "secper": { const prev = sec.period; sec.period = e.word; commit("box");
      return { undo: () => { if (prev == null) delete sec.period; else sec.period = prev; commit("box"); } }; }
    case "drums": {
      const targets = aim.scope === "song"
        ? SONG.filter(b => (b.stack || []).some(x => x.slots && x.slots.length)) : [secOf()];
      const prevKits = targets.map(b => b.kit);
      const prevMute = !!(MIXER && MIXER.drums && MIXER.drums.mute);
      if (e.on) {
        for (const b of targets) if (b.kit === "nodrums") delete b.kit;
        setMixOffset("drums", "mute", null);      // the other door drums leave through
      } else for (const b of targets) b.kit = "nodrums";
      commit("box");
      return { undo: () => {
        targets.forEach((b, i) => { if (prevKits[i] == null) delete b.kit; else b.kit = prevKits[i]; });
        if (e.on && prevMute) setMixOffset("drums", "mute", true);
        commit("box");
      } };
    }
    case "ops": {
      const targets = aim.scope === "song"
        ? SONG.filter(b => (b.stack || []).some(x => x.slots && x.slots.length)) : [secOf()];
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
function speak(p) {
  const cmds = nodeCmds();
  if (cmds.length >= MAX_CMDS) return;      // the tray already said so
  const undos = p.fx.map(applyOne);
  cmds.push({ text: p.text, undos, did: describeFx(p.fx, aim.scope) });
  tokens = [];
  draw();
}
function retract(cmd) {
  const cmds = nodeCmds();
  const i = cmds.indexOf(cmd);
  if (i < 0) return;
  for (const u of [...cmd.undos].reverse()) { try { u.undo(); } catch (e) { /* held */ } }
  cmds.splice(i, 1);
  draw();
}

/* ---------- the record's facts, for the state-aware grammar ---------- */
// what the aimed node actually HAS — the language refuses sentences about
// anything else ("align the grammar with the state of the song")
function ctxOf() {
  const secs = aim.scope === "song"
    ? SONG.filter(b => (b.stack || []).some(x => x.slots && x.slots.length))
    : [secOf()].filter(Boolean);
  const facts = { drumsOn: false, drumsOff: false,
    parts: { bass: false, melody: false, chords: false },
    rev: 1, revMax: SENDORDER.length - 1, echo: 1, echoMax: SENDORDER.length - 1 };
  for (const sec of secs) {
    const g = GENRES[gid(sec)] || {};
    const kitted = Object.keys(g.kit || {}).length > 0;
    const has = kitted && sec.kit !== "nodrums";
    if (has) facts.drumsOn = true;
    if (kitted && !has) facts.drumsOff = true;
    let keys = [];
    try { keys = partKeysOf(sec); } catch (e) { /* an empty box has no parts */ }
    for (const k of keys) {
      if (k === "bass") facts.parts.bass = true;
      else if (k.startsWith("pad")) facts.parts.chords = true;
      else if (k !== "drums") facts.parts.melody = true;
    }
  }
  if (aim.scope !== "song" && secs[0]) {
    const i = SENDORDER.indexOf(secs[0].rev); facts.rev = i < 0 ? 1 : i;
    const j = SENDORDER.indexOf(secs[0].echo); facts.echo = j < 0 ? 1 : j;
  }
  return facts;
}

/* ---------- draw ---------- */
const el = (tag, cls, text) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
export function draw() {
  if (!wrap) return;
  wrap.textContent = "";
  // THE GRAPH: the song node, then one node per playing section
  const graph = el("div", "rgraph");
  const node = (label, scope, si) => {
    const n = el("button", "rnode" + ((aim.scope === scope && aim.si === si) ? " on" : ""));
    n.type = "button";
    const cmds = scope === "song" ? ledger.song : (ledger.secs[si] || []);
    n.append(el("span", "rl", label), el("span", "rn", cmds.length ? cmds.length + "/" + MAX_CMDS : ""));
    n.addEventListener("click", () => { aim = { scope, si }; tokens = []; draw(); });
    return n;
  };
  graph.append(node("THE SONG", "song", -1));
  SONG.forEach((b, i) => {
    if (!(b.stack || []).some(x => x.slots && x.slots.length)) return;
    graph.append(node((i + 1) + " " + (b.cue || b.role || "section"), "section", i));
  });
  wrap.append(graph);

  // THE SENTENCE: what has been tapped; tap it to speak when it compiles
  const scope = aim.scope;
  const ctx = ctxOf();
  const p = tokens.length ? parse(tokens, scope, ctx) : null;
  const sent = el("div", "rsent" + (p ? " ok" : ""));
  sent.append(el("span", "rwords", tokens.length ? tokens.join(" ").toUpperCase() : "SAY SOMETHING"));
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
      " has heard five things — retract one to say more"));
  else {
    const next = continuations(tokens, scope, ctx);
    // ONE CHIP PER MEANING ("get rid of options I shouldn't click"): the
    // language holds every synonym, but a tray that offers "delay" and "the
    // delay" side by side is one thought twice. Each canon shows its first
    // form — the lexicon lists are authored best-form-first.
    const oneEach = (role) => {
      const seen = new Set(), out = [];
      const table = role === "verb" ? LEXICON.V : role === "subj" ? LEXICON.S : LEXICON.A;
      for (const [canon, syns] of Object.entries(table)) {
        const w = syns.find(x => next.has(x));
        if (w && !seen.has(canon)) { seen.add(canon); out.push(syns[0] !== w && next.has(syns[0]) ? syns[0] : w); }
      }
      return out;
    };
    const groups = [["say", "verb"], ["about", "subj"], ["how", "adj"]];
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
      const row = el("button", "rcmd");
      row.type = "button";
      row.title = "tap to retract";
      row.append(el("b", "rct", c.text), el("span", "rdid", "→ " + (c.did || "")));
      row.addEventListener("click", () => retract(c));
      lg.append(row);
    }
    wrap.append(lg);
  }
}

/* ---------- the couch resets with the record ---------- */
on("song", () => { ledger = { song: [], secs: {} }; tokens = []; aim = { scope: "song", si: -1 }; draw(); });
// the grammar reads the record, so the tray re-reads it when the record moves
on("box", draw);
on("mix", draw);
draw();
