// ui/lab.js — THE LAB: a bench where genres are crossed. Pick two or three
// parents, and the machine fills the half of a genre it can actually predict
// while the other half is left, named and empty, for a person.
//
// WHY THE PAGE IS SHAPED LIKE THIS, and it is the whole design: nukernel/
// INHERITANCE.md measured what crosses from parents to child over the entire
// catalog, field by field, and the answer split an anchor cleanly in two.
//
//   INHERITED — the ARCHITECTURE.  harmony 87% · realize 84% · diatonic 83% ·
//               rate 76% · tone.wave 74% · drumkit 61%
//   INVENTED  — the MATERIAL.      kit 16% · roots 7% · fill 3% · instr 3% ·
//               prog / words / kitVel / bassGrid 0%
//
// So the architecture arrives as READ-ONLY FACTS with their provenance printed
// beside them — combined from whom, plucked from whom — because that is the
// part the measurement says the machine is entitled to answer. And the material
// arrives as an INVENTION LIST with a ROLL key on every row, because a machine
// that offered to write the kit would be lying about exactly the half you would
// listen to. The dice draft something plausible for THIS architecture and the
// ear does the rest: a roll is a starting point with a seed on it, never an
// answer. Inventing the material is the fun part, and the page must read that
// way — the facts are quiet, the keys are on the material.
//
// THE ENGINE IS nukernel/lab.js, unchanged and not reimplemented here. This
// file picks parents, holds the seeds, paints the surface, plays the candidate
// and hands what survives to keepCandidate(). Every musical decision —
// synthesis, the pluck groups, the rollers, the novelty space, the place-year
// offers, the laws in validate() — is the bench's, and the view asks it.
//
// Layer graph: ui view — imports deps/state/derive/palette and audio/transport
// (a view may import audio; audio never imports back). It owns no audio path of
// its own: an audition is a scratch box in the ordinary SONG played by the
// ordinary transport (see §5), because a second play path is a second sound.
import { GENRES, loadLab, emptyBox } from "./deps.js";
import { SONG, SLOTS, loopOnly, setLoopOnly, saveNow,
         emit, on } from "./state.js";
import { chronoGenres, eraOf } from "./palette.js";
import { isBlank } from "./derive.js";
import { buzz } from "./touch.js";
import * as transport from "../audio/transport.js";

const wrap = document.getElementById("labwrap");

/* ---------------------------------------------------------------- §1 state */
// Everything the bench needs to be re-derived from scratch, and nothing else:
// the candidate itself is never stored, it is COMPUTED (§3) from these. That is
// what makes a seed shareable — the same picks, weights and seeds are the same
// genre on anyone's machine, and there is no fourth copy of the state to drift.
const MAX_PARENTS = 3;
let LAB = null;                  // the bench (nukernel/lab.js), once loaded
let PICK = [];                   // parent keys, in the order they were picked
const W = new Map();             // key -> weight, always summing to 1
let seed = 1;                    // the bench seed: architecture, names, drafts
const NONCE = new Map();         // material field -> how many times it was rolled
const MINE = new Map();          // material field -> what a person wrote instead
let label = "";                  // the coined name, "" until one is picked
let B = null;                    // the last build: { syn, cand, novelty, … }

// THE ROLL ORDER IS A DEPENDENCY ORDER, and it is lab.js's own (`ROLL_ORDER`):
// the fill reads the kit, kitVel reads the kit, the prog reads the roots, the
// words read the word. It is copied rather than imported because rollAll() takes
// ONE seed for every field and this page gives every field a seed of its own —
// so the walk happens here. GUARDED below: a material field the bench learns to
// roll that this list does not name throws at build time rather than silently
// going unrolled.
const ROLL_ORDER = ["kit", "kitVel", "fill", "roots", "prog", "instr",
                    "bassGrid", "word", "words"];
// which material fields get a direct control rather than only a roll. The rule
// is the brief's: the phrase editor already exists and is not rebuilt here, so
// a control earns its place only where ONE tap is a real musical edit — a step
// on or off, a chair recast. Everything else is rolled and read.
const LANEFIELDS = new Set(["kit", "fill"]);

// a field's seed is the bench's, walked one stride per press of its roll key —
// so a draft is named by (parents, seed, presses) and is reachable again
const seedAt = n => seed + n * 1009;
const fieldSeed = f => seedAt(NONCE.get(f) || 0);

/* ------------------------------------------------------------- §2 the load */
// The bench is ~123 KB of analysis tier (lab.js + its two oracles) and most
// sessions never open this tab, so it is fetched on first sight — by the rail
// on a phone, by the section scrolling into view on a desk, or by the first
// pick. ui/deps.js loadLab() owns the actual import (it is the only module
// allowed to read a global); this is just the one-shot.
let loading = false;
async function ensure() {
  if (LAB || loading) return LAB;
  loading = true;
  try { LAB = await loadLab(); } finally { loading = false; }
  build(); paint();
  return LAB;
}
on("page", d => { if (d.page === "lab") ensure(); });
if (wrap && typeof IntersectionObserver === "function") {
  // the desk case: every page is visible at once there, so nothing ever fires
  // a page event — the bench loads as the section comes up the screen
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); ensure(); }
  }, { rootMargin: "600px" });
  io.observe(wrap);
}

/* ------------------------------------------------------------- §3 the build */
// PARENTS + WEIGHTS + SEEDS -> a candidate, deterministically. The synthesis is
// the bench's; the material walk is here only because of the per-field seeds. A
// field a person has taken over (MINE) is never re-rolled — that is the whole
// contract of the roll key: dice draft, a person decides, and the dice do not
// take it back.
function build() {
  B = null;
  if (!LAB || !PICK.length) return;
  const missing = Object.keys(LAB.ROLLERS).filter(f => !ROLL_ORDER.includes(f));
  if (missing.length)
    throw new Error("ui/lab.js: the bench rolls " + missing.join(", ") +
                    " and this page has no order for it");
  const spec = {};
  for (const k of PICK) spec[k] = W.get(k);
  // the bench refuses some parents by name (a FUNCTION genre is a part, not a
  // style, and has no history to inherit). The chip bank cannot offer one —
  // it deals the DATED anchors and a function genre carries no year — but the
  // refusal is the engine's to make, so it is reported rather than pre-empted.
  let syn;
  try { syn = LAB.synthesize(spec, { seed }); }
  catch (e) { emit("status", { text: String(e.message || e), sticky: true }); return; }
  const want = new Set(syn.invention.map(i => i.field));
  const cand = { ...syn.candidate };
  for (const f of ROLL_ORDER) {
    if (!want.has(f)) continue;
    if (MINE.has(f)) { cand[f] = MINE.get(f); continue; }
    const v = LAB.roll(cand, f, fieldSeed(f), syn.parents);
    if (v == null) delete cand[f]; else cand[f] = v;
  }
  if (label) cand.label = label;
  B = { syn, cand, want,
        novelty: LAB.novelty(cand), names: LAB.names(syn, seed),
        problems: LAB.validate(cand) };
}

/* ------------------------------------------------------------ §4 the picks */
// THE WEIGHTS ALWAYS SUM TO 1. Moving one parent's share moves the others in
// proportion, so the bar on screen is the whole genome and never 140% of one.
// (readParents renormalizes anyway; this is so the NUMBERS a person is reading
// are the numbers the bench used.)
function normalize() {
  let t = 0;
  for (const k of PICK) t += W.get(k) || 0;
  if (!t) { for (const k of PICK) W.set(k, 1 / PICK.length); return; }
  for (const k of PICK) W.set(k, Math.round((W.get(k) / t) * 1e4) / 1e4);
}
function setWeight(key, v) {
  v = Math.max(0.05, Math.min(0.95, v));
  const others = PICK.filter(k => k !== key);
  if (!others.length) { W.set(key, 1); return; }
  const rest = others.reduce((s, k) => s + W.get(k), 0) || others.length;
  W.set(key, v);
  for (const k of others) W.set(k, (W.get(k) / rest) * (1 - v));
  normalize();
}
function togglePick(key) {
  const i = PICK.indexOf(key);
  if (i >= 0) PICK.splice(i, 1);
  else if (PICK.length >= MAX_PARENTS) {
    emit("status", { text: "three parents is the most a bench can hold — " +
      "unpick one to make room for " + (GENRES[key].label || key) });
    return;
  } else {
    // A NEW PARENT ARRIVES ON EQUAL TERMS and the ones already there are scaled
    // down to make room, keeping their ratios: two picks are 50/50, and a third
    // added to a 60/40 lands at 40/27/33 rather than resetting a weight
    // somebody set. (Giving the newcomer 1/n and renormalizing afterwards is
    // what made two picks 67/33 — the first one picked was simply worth more.)
    const share = 1 / (PICK.length + 1);
    for (const k of PICK) W.set(k, (W.get(k) || 0) * (1 - share));
    PICK.push(key);
    W.set(key, share);
  }
  for (const k of [...W.keys()]) if (!PICK.includes(k)) W.delete(k);
  normalize();
  // a different set of parents is a different genre: the hand edits and the
  // coined name belonged to the old one, and carrying them over would be the
  // machine quietly claiming a person's kit fits a bench they did not build
  MINE.clear(); NONCE.clear(); label = "";
  ensure();
  build(); paint(); reaudition();
}

// A ROLL MUST DRAFT SOMETHING ELSE, or the key reads as broken — and a plain
// seed bump does not guarantee it. The rollers are steered by the parents'
// measured densities, and a low one lands on the metrically strongest steps
// whatever the dice say: house + motown roll THE SAME KIT at seed after seed,
// because a four-on-the-floor kick and a backbeat on 2 and 4 are what those
// densities mean. So the key walks the seed until the value actually changes,
// tries a dozen strides and then says the true thing — that the architecture
// pins this one. Nothing is randomized to force a difference; the draft is
// still (parents, seed, presses) and still reachable again.
const ROLL_TRIES = 12;
function rollField(f) {
  if (!B) return;
  const was = say(B.cand[f], 1e5);
  let n = NONCE.get(f) || 0, moved = false;
  for (let i = 0; i < ROLL_TRIES; i++) {
    n++;
    const v = LAB.roll(B.cand, f, seedAt(n), B.syn.parents);
    if (say(v, 1e5) !== was) { moved = true; break; }
  }
  NONCE.set(f, n);
  MINE.delete(f);                       // the dice take it back only when asked
  if (!moved) emit("status", { text: "the architecture pins " + f +
    " — every draft these parents offer is the one already on the bench" });
  build(); paint(); reaudition();
}

/* --------------------------------------------------------- §5 the audition */
// HEAR IT NOW, THROUGH THE ORDINARY TRANSPORT. The candidate is registered in
// the live genre table under one reserved key, a scratch box that plays it is
// appended to the SONG, and that box is pinned as the loop — after which this
// file does nothing an audio module would notice. There is no second scheduler,
// no preview renderer and no forked mix: what you hear is what the arrangement
// would sound like, because it IS the arrangement, one box long.
//
// THE SCRATCH BOX MUST NEVER BE SAVED, and that is the only hard part. A box
// whose genre key is not in the table fails song.js's loader, which would take
// the whole song down to the default on the next reload — so the three ways an
// audition can end are all restorations, and the store is written clean on both
// sides of it:
//   * STOP, or a candidate change, or leaving through any other play — endAudition
//   * the song being edited or replaced under it — the "song"/"box" subscriptions
//   * the page going away — beforeunload, and visibilitychange in the CAPTURE
//     phase, which is what puts it AHEAD of ui/state.js's own save-on-hidden
//     (both listeners sit on window; capture wins the race by phase, not by
//     registration order, which is not ours to choose).
const LABKEY = "__lab_candidate__";
let scratch = null, savedLoop = null, mine = false, restartT = null;

// the candidate as a table entry: a name for the readouts, and nothing else
// changed. The bench's candidate IS an anchor — that is the point of validate()
// holding it to the same laws a hand-written one passes.
const playable = cand => ({ ...cand, label: cand.label || "the candidate" });

// which phrase the candidate plays. A blank phrase renders no events and a box
// with no events takes no time (derive.js songBars), so an audition against an
// empty bank would be silence with no reason printed anywhere.
function subjectSlot() {
  const i = SLOTS.findIndex(p => p && !isBlank(p));
  return i < 0 ? 0 : i;
}
function startAudition() {
  if (!B) return;
  GENRES[LABKEY] = playable(B.cand);
  if (!scratch) {
    saveNow();                          // the store holds the real song FIRST
    savedLoop = loopOnly;
    scratch = Object.assign(emptyBox(), { len: B.cand.bars || 4 });
    scratch.stack = [{ g: LABKEY, slots: [subjectSlot()] }];
    SONG.push(scratch);
  } else scratch.len = B.cand.bars || 4;
  const at = SONG.indexOf(scratch);
  setLoopOnly(at);
  mine = true;
  transport.startAt(at);
  paint();
}
function endAudition() {
  if (!scratch) return;
  transport.stop();
  const i = SONG.indexOf(scratch);
  if (i >= 0) SONG.splice(i, 1);
  scratch = null; mine = false;
  setLoopOnly(savedLoop != null && savedLoop < SONG.length ? savedLoop : null);
  savedLoop = null;
  delete GENRES[LABKEY];
  saveNow();                            // …and holds the real song again
  paint();
}
// a candidate that changes while it is sounding is replaced, not layered —
// debounced, because a weight slider changes it on every frame of a drag
function reaudition() {
  if (!scratch) return;
  clearTimeout(restartT);
  restartT = setTimeout(() => { if (scratch && B) startAudition(); }, 260);
}
on("transport:state", d => {
  // somebody pressed PLAY somewhere else: the song is the audible thing again,
  // and the scratch box has no business being in it
  if (d.playing && !mine) endAudition();
  mine = false;
  if (B) paint();                       // the play key's own legend follows it
});
on("song", endAudition);                // adopted a new song out from under it
on("box", endAudition);                 // …or edited the one that is loaded
addEventListener("beforeunload", endAudition);
addEventListener("visibilitychange", endAudition, true);

/* -------------------------------------------------------------- §6 keeping */
// THE SEAM THE NEXT PHASE WIDENS. Keeping a genre means adding it to the SONG's
// own set — which is a persistence question (song.js validates every box's genre
// key against the table on load, so a kept genre has to travel WITH the save or
// the song it is used in cannot be reopened). That save format is the next
// phase's; what is settled here is the gate in front of it: a candidate is held
// to the same laws a hand-written anchor is, and a KEEP that would put a broken
// genre in a song is refused by name.
//
// So this keeps them IN MEMORY and says so. It deliberately does NOT write the
// genre table: a box pointing at a genre the save cannot carry is exactly the
// failure that would lose somebody's song.
export const KEPT = [];
const keptHooks = [];
export const onKept = fn => keptHooks.push(fn);       // the next phase's hook
// a key for the table, from the name a person coined: "Sheffield 1989" ->
// "sheffield1989", never colliding with an anchor or with an earlier keep
function keyFor(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "") || "genre";
  let k = base, n = 2;
  while (GENRES[k] || KEPT.some(e => e.key === k)) k = base + "_" + n++;
  return k;
}
export function keepCandidate(cand, ctx) {
  // the laws live in the bench, so there is no keeping anything before it has
  // loaded — and a keep that "succeeded" unvalidated is the one outcome this
  // function exists to prevent
  if (!LAB) return { ok: false, problems: [{ level: "error", code: "unloaded",
    field: null, msg: "the bench has not loaded yet — nothing can be validated" }] };
  const problems = LAB.validate(cand);
  if (!LAB.ok(problems)) {
    const first = problems.find(p => p.level === "error");
    emit("status", { text: "the bench refuses it — " +
      (first.field ? first.field + ": " : "") + first.msg, sticky: true });
    return { ok: false, problems };
  }
  const entry = { key: keyFor(cand.label), genre: cand, problems,
                  parents: { ...(ctx && ctx.parents) }, seed: (ctx && ctx.seed) | 0 };
  KEPT.push(entry);
  for (const fn of keptHooks) { try { fn(entry); } catch (e) { /* a listener is not the keep */ } }
  emit("status", { text: "kept " + cand.label + " — " + entry.key +
    " is in this session's genre set" });
  return { ok: true, entry, problems };
}

/* ------------------------------------------------------- §7 saying a value */
// The architecture is half closures (`entry`, `reg`, `realize`), so a value is
// printed as its own SOURCE where it has one and as compact data everywhere
// else. Nothing is summarized into an adjective: the page's promise is that the
// facts on it are the facts the renderer reads.
// THE CAP IS THE WHOLE VALUE'S, not each leaf's: capping the leaves at some
// small number printed `{ r: [7, 4, 6, 4, 7, 4, 7, 4… }` for a sixteen-step
// velocity lane that fits on the line with room to spare. Children inherit the
// budget and the one trim happens at the end.
function say(v, n) {
  const cap = n || 96;
  let s;
  if (typeof v === "function") s = String(v).replace(/\s+/g, " ");
  else if (v == null) s = "—";
  else if (Array.isArray(v)) s = "[" + v.map(x => say(x, cap)).join(", ") + "]";
  else if (typeof v === "object")
    s = "{ " + Object.entries(v).map(([k, x]) => k + ": " + say(x, cap)).join(", ") + " }";
  else s = typeof v === "string" ? v : String(v);
  return s.length > cap ? s.slice(0, cap - 1) + "…" : s;
}
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const degLine = ds => (ds || []).map(d => ROMAN[d % 7] || d).join(" · ");
// the two sevenths are DIFFERENT CHORDS and the line says which: "7" is the
// seventh the mode already owns, "dom7" the absolute stack natural minor cannot
// spell (kernel.js QSTEPS/QFIX). Printing both as "7" would hide the one
// decision the prog roller actually makes.
const progLine = pr => (pr || []).map(s => {
  const c = Array.isArray(s) ? s[0] : s;
  return (ROMAN[(c.d || 0) % 7] || c.d) +
         (c.q === "dom7" ? "7(dom)" : c.q === "7" ? "7" : c.q ? " " + c.q : "");
}).join(" · ");
// the rolled `word`, said in the bench's own words: PALETTE is exported for
// exactly this, so the sentence on screen comes from the same table the
// operator did and cannot promise a move the closure does not make
function wordLines(word) {
  const table = word && word.__labTable;
  if (!table) return [];
  return table.map((rows, v) => "voice " + (v + 1) + ": " + rows.map(ops =>
    ops.length ? ops.map(o => LAB.PALETTE.find(p => p.id === o.id).say(o.arg)).join(" + ")
               : "as written").join("  /  "));
}

/* ------------------------------------------------------------- §8 painting */
// ONE REBUILD PER USER ACTION. Every other table on this machine patches
// because it is repainted during a scrub or a playhead frame; this surface is
// touched only when a person changes something, so a rebuild is the honest
// simple thing and there is no element cache to go stale.
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
function section(name) {
  const s = el("div", "labsec");
  s.append(el("span", "glab", name));
  return s;
}
function key(txt, cls, fn) {
  const b = el("button", "btn " + (cls || ""), txt);
  b.type = "button";
  b.addEventListener("click", ev => { ev.preventDefault(); buzz(4); fn(ev); });
  return b;
}

function paint() {
  if (!wrap) return;
  wrap.textContent = "";
  wrap.append(paintTop(), paintParents());
  if (!B) return;
  wrap.append(paintHear(), paintArch(), paintMaterial(),
              paintNovelty(), paintNames(), paintKeep());
}

// THE HEAD: what this thing is called and what it is, in the biggest type on
// the page, plus the seed it was drafted at. No word "lab" anywhere — the tab
// said that already.
function paintTop() {
  const t = el("div", "labtop");
  const c = B && B.cand;
  t.append(el("div", "labtitle" + (c && c.label ? "" : " un"),
    c ? (c.label || "an unnamed genre") : "cross two genres"));
  t.append(el("div", "labsub", c
    ? PICK.map(k => (GENRES[k].label || k) + " " +
        Math.round(W.get(k) * 100) + "%").join("  ·  ") +
      "   —   " + c.bpm + " bpm, " + c.bars + " bars, " + c.voices +
      (c.voices === 1 ? " voice" : " voices") + ", " + c.harmony
    : "the machine fills the architecture; the material is yours to invent"));
  const s = el("div", "labdice");
  s.append(el("output", "labseed", "seed " + seed));
  s.append(key("⟳", "labre", () => {
    seed = (seed % 9999) + 1;
    NONCE.clear();                      // a new seed is a new draft of everything
    build(); paint(); reaudition();
  }));
  t.append(s);
  return t;
}

// THE PARENTS: the same chronological bank the genre menu deals ("organize the
// genres chronologically", with the era tint on each chip's dot), filtered to
// the anchors that HAVE a history — a function genre is a part, not a style,
// and the bench refuses one anyway.
function paintParents() {
  const s = section("parents");
  if (PICK.length) {
    const bar = el("div", "dnabar");
    const keys = el("div", "dnakeys");
    const STRAND = ["--v0", "--v1", "--v2", "--v3"];
    PICK.forEach((k, i) => {
      const seg = el("i", "dnaseg");
      seg.style.setProperty("--w", (W.get(k) * 100).toFixed(2) + "%");
      seg.style.setProperty("--c", "var(" + STRAND[i % STRAND.length] + ")");
      seg.dataset.parent = k;
      seg.dataset.share = W.get(k).toFixed(4);
      bar.append(seg);
      // .knob is the machine's own fader recipe (a 4px track, a plain accent
      // cap, the value in mono beside it) — worn rather than copied, so the
      // weight faders are the same object as the tempo and volume faders
      const row = el("label", "knob labw");
      const dot = el("i");
      dot.style.setProperty("--c", "var(" + STRAND[i % STRAND.length] + ")");
      // the strand dot lives INSIDE the name, not beside it: as its own flex
      // child it wraps onto a line of its own at phone width, and a coloured
      // square alone on a row is a legend for nothing
      const nm = el("span", "labwn");
      nm.append(dot, document.createTextNode(GENRES[k].label || k));
      row.append(nm);
      const r = el("input", "labwr");
      Object.assign(r, { type: "range", min: 5, max: 95, step: 1,
                         value: Math.round(W.get(k) * 100) });
      r.setAttribute("aria-label", (GENRES[k].label || k) + " share");
      r.addEventListener("input", () => {
        setWeight(k, r.value / 100);
        build(); paintOnly(); reaudition();
      });
      row.append(r, el("b", "labwv", Math.round(W.get(k) * 100) + "%"));
      keys.append(row);
    });
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", PICK.map(k => (GENRES[k].label || k) + " " +
      Math.round(W.get(k) * 100) + "%").join(", "));
    s.append(bar, keys);
  }
  const chips = el("div", "pchips labchips");
  // the DATED anchors, which is exactly the set the bench will accept: a
  // function genre ("Simple", "Backing vocals") carries no year because it has
  // no history, and no year is the same fact readParents refuses on. The
  // candidate on the bench is skipped by name — while it is auditioning it sits
  // in the live table under LABKEY, and a genre cannot be its own parent.
  const { dated } = chronoGenres();
  for (const k of dated) {
    if (k === LABKEY) continue;
    const b = el("button", "pchip gen" + eraOf(k) + (PICK.includes(k) ? " on" : ""),
                 GENRES[k].label || k);
    b.type = "button";
    b.dataset.genre = k;
    b.setAttribute("aria-pressed", String(PICK.includes(k)));
    b.addEventListener("click", () => { buzz(4); togglePick(k); });
    chips.append(b);
  }
  s.append(chips);
  return s;
}
// THE ONE EXCEPTION TO THE REBUILD, and it is a real one: a weight drag must
// not rebuild the fader it is dragging. Replacing the input under the finger
// drops the pointer capture and the fader stops following the thumb halfway
// through the gesture. So the parents section is left exactly where it is — its
// numbers and its bar are patched in place — and everything downstream of the
// weights is rebuilt as usual.
function paintOnly() {
  if (!wrap || !B) return;
  const kids = [...wrap.children];
  const parents = kids[1];
  if (parents) {
    parents.querySelectorAll(".labwv").forEach((b, i) => {
      const t = Math.round(W.get(PICK[i]) * 100) + "%";
      if (b.textContent !== t) b.textContent = t;
    });
    parents.querySelectorAll(".dnaseg").forEach((g, i) =>
      g.style.setProperty("--w", (W.get(PICK[i]) * 100).toFixed(2) + "%"));
  }
  wrap.replaceChild(paintTop(), kids[0]);
  for (const n of kids.slice(2)) n.remove();
  wrap.append(paintHear(), paintArch(), paintMaterial(),
              paintNovelty(), paintNames(), paintKeep());
}

// HEAR IT: one accent key, and the truth about what it is doing.
function paintHear() {
  const s = el("div", "labsec labhear");
  s.append(key(scratch ? "■ Stop" : "▶ Hear it", "go labplay",
    () => (scratch ? endAudition() : startAudition())));
  s.append(el("span", "labstatus", scratch
    ? "the candidate is looping in a scratch box — it is not in your song"
    : "one box, looped, through the ordinary transport"));
  return s;
}

// THE ARCHITECTURE: facts, with their provenance. Every row says where it came
// from, because "combined" and "plucked from techno" are different claims and
// the page must not blur them into "generated".
function paintArch() {
  const s = section("architecture — what the parents actually carry");
  const t = el("div", "labtbl");
  for (const m of B.syn.manifest) {
    if (m.class === "invent") continue;
    const row = el("div", "labarow");
    row.dataset.field = m.field;
    row.dataset.class = m.class;
    row.append(el("b", "labf", m.field));
    row.append(el("span", "labv", m.field === "parents"
      ? PICK.map(k => k + " " + Math.round(W.get(k) * 100) + "%").join(" + ")
      : say(m.value)));
    const from = m.class === "plucked" ? "plucked from " + m.from
      : m.class === "derived" ? "derived from " + m.from
      : m.class === "snapped" ? "snapped to a parent's own value"
      : m.class === "combined" ? "combined" + (m.from ? " (wave from " + m.from + ")" : "")
      : m.class;
    row.append(el("span", "labp " + m.class, from + (m.note ? " — " + m.note : "")));
    t.append(row);
  }
  s.append(t);
  return s;
}

// THE MATERIAL: the invention list. A roll key per row, the reason it is on the
// list under it, and a direct control where one tap is a real edit.
function paintMaterial() {
  const s = section("material — the machine does not write this; you do");
  const t = el("div", "labtbl");
  for (const inv of B.syn.invention) {
    const f = inv.field;
    const row = el("div", "labmrow");
    row.dataset.field = f;
    const head = el("div", "labmhead");
    head.append(el("b", "labf", f));
    head.append(key("⟳ roll", "labroll", () => rollField(f)));
    if (MINE.has(f)) head.append(el("span", "labmine", "yours"));
    head.append(el("span", "labfseed", "seed " + fieldSeed(f)));
    row.append(head, el("p", "labp", inv.why));
    row.append(paintValue(f, B.cand[f]));
    t.append(row);
  }
  s.append(t);
  return s;
}
function paintValue(f, v) {
  if (v == null) return el("div", "labmval", "—");
  if (LANEFIELDS.has(f) && typeof v === "object") return laneGrid(f, v);
  if (f === "roots") return el("div", "labmval big", degLine(v));
  if (f === "prog") return el("div", "labmval big", progLine(v));
  if (f === "instr") return instrRow(v);
  if (f === "words") {
    const d = el("div", "labmval");
    for (const line of v) d.append(el("p", "labline", line));
    return d;
  }
  if (f === "word") {
    const d = el("div", "labmval");
    for (const line of wordLines(v)) d.append(el("p", "labline", line));
    if (!d.children.length) d.append(el("p", "labline", "nothing — every voice as written"));
    return d;
  }
  if (f === "kitVel" || f === "bassGrid")
    return el("div", "labmval mono", say(v, 220));
  return el("div", "labmval mono", say(v, 220));
}

// A KIT AS SIXTEEN STEPS PER LANE, and tapping one is the edit. This is not the
// phrase editor and does not want to be: no pitch, no velocity, no page — a
// drum either hits on that sixteenth or it does not, which is the one edit
// worth a tap here. The quarter colours are the machine's own (--step-q1..4).
function laneGrid(field, kit) {
  const g = el("div", "labkit");
  for (const [lane, vec] of Object.entries(kit)) {
    if (!Array.isArray(vec)) continue;
    const row = el("div", "labkrow");
    row.append(el("b", "labklab", lane));
    const steps = el("div", "labksteps");
    vec.forEach((x, i) => {
      const c = el("button", "labstep q" + (Math.floor(i / 4) + 1) + (x ? " on" : ""));
      c.type = "button";
      c.dataset.lane = lane;
      c.dataset.step = String(i);
      c.setAttribute("aria-pressed", String(!!x));
      c.setAttribute("aria-label", lane + " step " + (i + 1));
      c.addEventListener("click", () => {
        const next = JSON.parse(JSON.stringify(MINE.get(field) || kit));
        next[lane][i] = x ? 0 : 1;
        MINE.set(field, next);
        buzz(4); build(); paint(); reaudition();
      });
      steps.append(c);
    });
    row.append(steps);
    g.append(row);
  }
  return g;
}

// THE BAND, one chip per voice, tapping through the instruments the PARENTS
// themselves play. The dice draw from the whole family pool (lab.js familyPool)
// and stay the way to reach it; a tap wants a short list you can recognise.
function instrRow(v) {
  const ids = Array.isArray(v) ? v : [v];
  const pool = [];
  for (const k of PICK) {
    const e = GENRES[k].instr;
    for (const id of (Array.isArray(e) ? e : [e])) if (id && !pool.includes(id)) pool.push(id);
  }
  for (const id of ids) if (id && !pool.includes(id)) pool.push(id);
  const d = el("div", "labmval labinstr");
  ids.forEach((id, i) => {
    const b = el("button", "pchip gen", String(id).replace(/_/g, " "));
    b.type = "button";
    b.dataset.voice = String(i);
    b.setAttribute("aria-label", "voice " + (i + 1) + " plays " +
      String(id).replace(/_/g, " ") + " — tap for the next instrument the parents play");
    b.addEventListener("click", () => {
      const next = ids.slice();
      next[i] = pool[(pool.indexOf(id) + 1) % pool.length];
      MINE.set("instr", next.length === 1 ? next[0] : next);
      buzz(4); build(); paint(); reaudition();
    });
    d.append(b);
  });
  return d;
}

// NOVELTY: is this a new genre or an old one wearing a hat? The verdict is the
// bench's sentence, printed whole — it is already the whole answer in one
// clause, and paraphrasing it here would be a second opinion nobody measured.
function paintNovelty() {
  const s = section("novelty");
  const n = B.novelty;
  const v = el("div", "labverdict " + n.band);
  v.dataset.band = n.band;
  v.dataset.nearest = n.nearest;
  v.textContent = n.verdict;
  s.append(v);
  s.append(el("p", "labp", "nearest " + n.nearest + " (" + n.label + ") at " +
    n.dist.toFixed(2) + " — the table's own neighbours sit at " +
    n.thresholds.p10.toFixed(2) + " / " + n.thresholds.median.toFixed(2) +
    ".  next: " + n.ranked.slice(1).map(r => r.key + " " + r.dist.toFixed(1)).join(", ")));
  if (n.note) s.append(el("p", "labp", n.note));
  return s;
}

// THE NAME: place-year offers, and a field to coin one of your own. The bench
// offers and never picks (§4 of lab.js), so nothing is filled in for you — and
// every offer is already checked against the labels the table holds.
function paintNames() {
  const s = section("name");
  const chips = el("div", "pchips labnames");
  for (const n of B.names) {
    const b = el("button", "pchip gen" + (label === n.label ? " on" : ""), n.label);
    b.type = "button";
    b.dataset.name = n.label;
    b.title = n.why;
    b.setAttribute("aria-pressed", String(label === n.label));
    b.append(el("span", "labwhy", n.why));
    b.addEventListener("click", () => {
      label = label === n.label ? "" : n.label;
      buzz(4); build(); paint();
    });
    chips.append(b);
  }
  s.append(chips);
  const coin = el("input", "labcoin");
  Object.assign(coin, { type: "text", value: label,
                        placeholder: "…or coin one: Lagos 2031" });
  coin.setAttribute("aria-label", "coin a name for this genre");
  coin.addEventListener("change", () => {
    label = coin.value.trim();
    build(); paint();
  });
  s.append(coin);
  return s;
}

// KEEP: the gate, and what is behind it. Errors are printed by name — a genre
// that cannot be kept says which law it broke, in the law's own words.
function paintKeep() {
  const s = section("keep");
  const errs = B.problems.filter(p => p.level === "error");
  const warns = B.problems.filter(p => p.level === "warn");
  const k = key("+ Keep this genre", "go labkeep", () => {
    const r = keepCandidate(B.cand, { parents: B.syn.parents, seed });
    if (r.ok) paint();
  });
  k.disabled = !!errs.length || !label;
  s.append(k);
  s.append(el("span", "labstatus", errs.length
    ? errs.length + " error" + (errs.length === 1 ? "" : "s") + " — this cannot be kept"
    : !label ? "a genre in a song needs a name — pick one above, or coin it"
    : "it passes every law a hand-written anchor passes" +
      (warns.length ? ", with " + warns.length + " to look at" : "")));
  for (const p of B.problems)
    s.append(el("p", "labprob " + p.level,
      (p.field ? p.field + " — " : "") + p.msg));
  if (KEPT.length) {
    const kept = el("div", "pchips labkept");
    for (const e of KEPT) {
      const b = el("button", "pchip gen on", e.genre.label);
      b.type = "button";
      b.dataset.kept = e.key;
      b.append(el("span", "labwhy", Object.keys(e.parents).join(" + ")));
      b.addEventListener("click", () => {
        // reopen a kept genre on the bench: its parents and seed are all it
        // was, which is what makes a kept genre a thing you can argue with
        PICK = Object.keys(e.parents);
        W.clear();
        for (const p of PICK) W.set(p, e.parents[p]);
        seed = e.seed; label = e.genre.label;
        MINE.clear(); NONCE.clear();
        normalize(); build(); paint(); reaudition();
      });
      kept.append(b);
    }
    s.append(kept);
  }
  return s;
}

/* ---------------------------------------------------------------- §9 boot */
// The shell paints immediately — the parent bank is real data and needs no
// bench — and the bench itself arrives on the first sight of the tab.
if (wrap) paint();

// WHAT THE BENCH IS HOLDING, for a probe: the same rule audio/ follows
// (window.__nu*), and the same reason — a surface nobody can read from the
// outside is a surface that can only be checked by eye.
window.__nuLab = () => ({
  loaded: !!LAB, parents: PICK.slice(),
  weights: PICK.map(k => W.get(k)), seed,
  nonce: [...NONCE.entries()], mine: [...MINE.keys()], label,
  candidate: B ? { label: B.cand.label || null, bars: B.cand.bars,
                   voices: B.cand.voices, bpm: B.cand.bpm,
                   harmony: B.cand.harmony, drumkit: B.cand.drumkit } : null,
  // the material goes out WHOLE, not at the page's reading length: a probe
  // comparing two drafts of a kit needs the sixteenth that differs, and the
  // first two hundred characters of two kits with the same kick are equal
  material: B ? Object.fromEntries(B.syn.invention.map(i =>
    [i.field, say(B.cand[i.field], 1e5)])) : null,
  novelty: B ? { band: B.novelty.band, nearest: B.novelty.nearest,
                 dist: B.novelty.dist } : null,
  names: B ? B.names.map(n => n.label) : [],
  problems: B ? B.problems.map(p => p.level + ":" + p.code) : [],
  auditioning: !!scratch, songLen: SONG.length,
  kept: KEPT.map(e => e.key),
});
