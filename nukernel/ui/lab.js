// ui/lab.js — THE LAB: a bench where genres are crossed, and mixed. Pick two
// or three parents and slide their weights; the machine fills the half of a
// genre it can measure (the inheritance study: harmony 87%, realize 84%,
// rate 76%, drumkit 61% cross from parent to child) and drafts the half it
// cannot, on the dice, for a person to argue with.
//
// The page used to print
// its own working — a provenance table, a novelty verdict, a paragraph of
// "why" under every roll. All of that is still computed (§3, §7 below, and
// nukernel/lab.js itself — nothing there changed) because Keep still gates on
// it; it is just no longer SAID. What stays on screen: the mix (sliders that
// renormalise, so the blend on screen is always the whole blend), the shape
// of the band (drum steps and the instrument roster — a bar or a shape, never
// a sentence), the invention keys as icons with a tooltip, and the Keep gate.
//
// AND IT PLAYS ITSELF. Picking a genre or moving a slider takes over the
// ordinary transport immediately (§5) — there is no "Hear it" key any more,
// because on this page there is nothing else to hear. Every later change
// updates the SAME scratch box in place instead of restarting it: the bar
// already handed to WebAudio finishes exactly as it started, and only the
// next bar the scheduler reaches hears the new blend — one bar, on the beat,
// the same "something changed" path every other live edit on this machine
// already takes (audio/live.js `on("box", …)`, just asked more often).
//
// THE ENGINE IS nukernel/lab.js, unchanged and not reimplemented here. This
// file picks parents, holds the seeds, keeps the scratch box in the ordinary
// SONG in step with the candidate, and hands what survives to
// keepCandidate(). Every musical decision — synthesis, the pluck groups, the
// rollers, the novelty space, the place-year offers, the laws in validate()
// — is the bench's, and the view asks it.
//
// Layer graph: ui view — imports deps/state/derive/palette and audio/transport
// (a view may import audio; audio never imports back). It owns no audio path of
// its own: an audition is a scratch box in the ordinary SONG played by the
// ordinary transport (see §5), because a second play path is a second sound.
import { GENRES, loadLab, emptyBox } from "./deps.js";
import { SONG, SLOTS, loopOnly, setLoopOnly, saveNow, GENRESET,
         keepGenre, useBench, emit, on } from "./state.js";
import { chronoGenres, eraOf } from "./palette.js";
import { isBlank } from "./derive.js";
import { buzz } from "./touch.js";
import * as transport from "../audio/live.js";

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

// (THE ROLL ORDER AND THE SEED STRIDE ARE THE BENCH'S, not this page's. They
// were copied here while the per-field walk lived on the page; the walk is
// `LAB.rebuild` now — §3 — because a kept genre is stored as its recipe and
// REBUILT on load, and if the page held the stride and the loader held another,
// a genre somebody kept would come back as a different genre on the next
// reload. One number, one place, three callers: this page, the song loader and
// nukernel/promote-genre.js.)
// which material fields get a direct control rather than only a roll. The rule
// is the brief's: the phrase editor already exists and is not rebuilt here, so
// a control earns its place only where ONE tap is a real musical edit — a step
// on or off, a chair recast. Everything else is rolled and read.
const LANEFIELDS = new Set(["kit", "fill"]);

// a field's seed is the bench's, walked one stride per press of its roll key —
// so a draft is named by (parents, seed, presses) and is reachable again
const seedAt = n => LAB.seedAt(seed, n);
// THE RECIPE — the four facts a kept genre is stored as, and the same four this
// page is holding at any moment: parents + weights, the bench seed, the presses
// and the hand edits. Assembling it here rather than only at the keep is what
// makes the page and the save the same object: what you are looking at IS what
// would be written, and `LAB.rebuild` reads it either way.
function recipeNow() {
  const parents = {};
  for (const k of PICK) parents[k] = W.get(k);
  const rolls = {}, mine = {};
  for (const [f, n] of NONCE) if (n) rolls[f] = n;
  for (const [f, v] of MINE) mine[f] = v;
  const r = { label, parents, seed };
  if (Object.keys(rolls).length) r.rolls = rolls;
  if (Object.keys(mine).length) r.mine = mine;
  return r;
}

/* ------------------------------------------------------------- §2 the load */
// The bench is ~123 KB of analysis tier (lab.js + its two oracles) and most
// sessions never open this tab, so it is fetched on first sight — by the rail
// on a phone, by the section scrolling into view on a desk, or by the first
// pick. ui/deps.js loadLab() owns the actual import (it is the only module
// allowed to read a global); this is just the one-shot.
// THE IN-FLIGHT LOAD IS AWAITED, not skipped. Three things arm this — the rail,
// the observer, and the song loader's rebuilder — and a second caller that
// returned `null` because the first was still fetching would leave a kept genre
// standing in for itself forever. One promise, every caller on it.
let loadingP = null;
function ensure() {
  if (LAB) return Promise.resolve(LAB);
  if (!loadingP) loadingP = loadLab().then(l => {
    LAB = l; build(); paint(); return l;
  });
  return loadingP;
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
  // the bench refuses some parents by name (a FUNCTION genre is a part, not a
  // style, and has no history to inherit). The chip bank cannot offer one —
  // it deals the DATED anchors and a function genre carries no year — but the
  // refusal is the engine's to make, so it is reported rather than pre-empted.
  const recipe = recipeNow();
  // THE STUB SEAT COLLIDES WITH THE LIVE SEAT — and only now that the page
  // plays while you edit does that matter. nukernel/lab.js reserves ONE key,
  // "__lab_candidate__" (its STUB), to seat a candidate for the length of a
  // single synchronous call (§1 withStub) — validate() and novelty() both
  // take that seat on every rebuild. This file reserves the SAME key, LABKEY,
  // for the audition's live entry, and holds it for as long as the audition
  // plays. So a rebuild fired WHILE auditioning finds its own seat already
  // taken and refuses ("the bench is already occupied") — harmless once, when
  // a person could only edit before pressing Hear It; a rebuild on every
  // slider frame while it plays. So the live entry steps aside for the one
  // synchronous call that needs the seat and is put straight back — nothing
  // else runs in between (no await here) to find it missing.
  const held = GENRES[LABKEY];
  if (held) delete GENRES[LABKEY];
  let r;
  try { r = LAB.rebuild(recipe); }
  catch (e) { emit("status", { text: String(e.message || e), sticky: true }); return; }
  finally { if (held) GENRES[LABKEY] = held; }
  B = { syn: r, cand: r.candidate, want: r.want, recipe,
        novelty: r.novelty, names: r.names, problems: r.problems };
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
    scratch = Object.assign(emptyBox(), { len: B.cand.bars || 4, labgen: 0 });
    scratch.stack = [{ g: LABKEY, slots: [subjectSlot()] }];
    SONG.push(scratch);
  } else scratch.len = B.cand.bars || 4;
  const at = SONG.indexOf(scratch);
  setLoopOnly(at);
  mine = true;
  transport.startAt(at);
  // THE MAIN TRANSPORT IS NOW PLAYING THE LAB — said once, through the same
  // status channel every other transport announcement uses (a sticky line
  // survives exactly one readout render; ui/readout.js). The genre field on
  // that same row reads the candidate's own name for as long as the scratch
  // box keeps sounding, which is the ongoing half of this sentence.
  emit("status", { text: "the transport is playing the lab", sticky: true });
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
// A CHANGE UPDATES THE MIX IN PLACE, ON THE NEXT BAR — never a restart.
// Debounced, because a weight slider fires on every frame of a drag and only
// the SETTLED mix is worth a transition; once it fires, the scratch box does
// not move and only what LABKEY names changes, so the bar already handed to
// WebAudio (fire-and-forget, nothing recalls it) finishes exactly as it
// started and the very next bar the scheduler reaches hears the new blend.
//
// `labgen` is a nonce ON THE SCRATCH BOX ITSELF, bumped every update.
// ui/derive.js sectionRender caches a box's render keyed on JSON.stringify of
// the box — blind to GENRES[LABKEY]'s own content changing underneath an
// unchanged box — so without a changing key ON THE BOX the cache would keep
// serving the OLD mix forever. `emit("box", …)`, not commit(): this is the
// the transport's own "something changed" signal (audio/live.js
// `on("box", changed)` recompiles the bar list, `on("box", remix)` reroutes
// the channel at the next scheduled bar), with no restart and — because it is
// emit and not commit — no save, which matters: the scratch box must never
// reach the store (§5's own law, restated at endAudition).
// SUPPRESSED ONLY AROUND OUR OWN emit — a real edit to any box, the scratch
// one included, still ends the audition (below): the point of the flag is
// only to stop this file's own "box" announcement from eating itself.
let ownBoxEvent = false;
function reaudition() {
  clearTimeout(restartT);
  if (!B) { endAudition(); return; }
  if (!scratch) { startAudition(); return; }   // nothing sounding yet — now
  restartT = setTimeout(() => {
    if (!scratch || !B) return;
    GENRES[LABKEY] = playable(B.cand);
    scratch.len = B.cand.bars || 4;
    scratch.labgen = (scratch.labgen || 0) + 1;
    ownBoxEvent = true;
    emit("box", {});
    ownBoxEvent = false;
    paint();
  }, 220);
}
on("transport:state", d => {
  // somebody pressed PLAY somewhere else: the song is the audible thing again,
  // and the scratch box has no business being in it
  if (d.playing && !mine) endAudition();
  mine = false;
  if (B) paint();                       // the play key's own legend follows it
});
on("song", endAudition);                // adopted a new song out from under it
on("box", () => { if (!ownBoxEvent) endAudition(); });  // …or a real edit, anywhere
// THE LAB IS WHAT YOU ARE HEARING WHILE YOU ARE ON THE LAB PAGE — leaving it
// ends the audition, the same way switching to a real play elsewhere does.
// On the desk, where every page shows at once and the rail never fires this
// event, there is nothing to leave and this simply never runs.
on("page", d => { if (d.page !== "lab") endAudition(); });
addEventListener("beforeunload", endAudition);
addEventListener("visibilitychange", endAudition, true);

/* -------------------------------------------------------------- §6 keeping */
// A KEPT GENRE LIVES IN THE SONG. Not in this module, not in a session cache —
// in the record, as a recipe, beside the boxes (song.js `genres`), because
// song.js validates every box's genre key on load and a genre that does not
// travel with the save is a song that cannot be reopened. The store owns the
// installing and the persisting (ui/state.js keepGenre); what is settled HERE
// is the gate in front of it: a candidate is held to the same laws a
// hand-written anchor is, and a keep that would put a broken genre in a song is
// refused by name, before the song has heard of it.
//
// WHAT IS STORED IS THE RECIPE, NEVER THE ANCHOR. Half of a genre is closures
// and JSON drops a function without saying so; the recipe is the parents, the
// seed, the presses and the hand edits, and `LAB.rebuild` walks those back to
// the same anchor on any machine (§3). So the DNA of a shared genre is true by
// construction — its parents are catalog anchors the recipient already has.
export const KEPT = [];
const keptHooks = [];
export const onKept = fn => keptHooks.push(fn);
// THE LOADER'S REBUILDER, handed to the store as this module evaluates — which
// is before boot adopts the saved song, and is why a song with an invented
// genre in it comes back playing that genre rather than a stand-in. The bench
// is fetched on demand here exactly as the tab fetches it; a page that never
// opens the LAB and never loads a lab song never pays for it.
useBench(async recipe => {
  const L = await ensure();
  if (!L) return null;
  const r = L.rebuild(recipe);
  // the same gate the keep passed, asked again on the way back in: a catalog
  // that moved under a saved recipe can make a genre that no longer holds, and
  // the stand-in is a better answer than an anchor that throws mid-bar
  return L.ok(r.problems) ? r.candidate : null;
});
// THE BENCH'S OWN SHELF IS THE SONG'S SET, not a list this module accumulates.
// A song opened off the desktop brings its invented genres with it and they
// have to appear here — reopenable, arguable, re-rollable — or the record would
// carry a genre its own bench had never heard of.
on("song", () => {
  KEPT.length = 0;
  for (const [key, r] of Object.entries(GENRESET))
    KEPT.push({ key, genre: GENRES[key], recipe: r, problems: [],
                parents: { ...r.parents }, seed: r.seed | 0 });
  paint();
});
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
  const recipe = (ctx && ctx.recipe) || recipeNow();
  const key = keepGenre(recipe, cand);
  const entry = { key, genre: cand, problems, recipe,
                  parents: { ...recipe.parents }, seed: recipe.seed | 0 };
  KEPT.push(entry);
  for (const fn of keptHooks) { try { fn(entry); } catch (e) { /* a listener is not the keep */ } }
  emit("status", { text: "kept " + cand.label + " — " + key +
    " is this song's own, and plays anywhere a genre plays" });
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
// NO LEGEND — the row of sections used to open each one with a name in
// silkscreen ("architecture", "material", "novelty"); the hairline between
// them is the only divider a wordless page needs.
function section() { return el("div", "labsec"); }
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
  wrap.append(paintBand(), paintNames(), paintKeep());
}

// THE HEAD: what this thing is called, in the biggest type on the page, and
// the seed it was drafted at — nothing else. No word "lab" anywhere, the tab
// said that already; no bpm/bars/voices/harmony sentence either, because the
// parents' own sliders below already say the one thing that changed them.
function paintTop() {
  const t = el("div", "labtop");
  const c = B && B.cand;
  t.append(el("div", "labtitle" + (c && c.label ? "" : " un"),
    c ? (c.label || "an unnamed genre") : "cross two genres"));
  const s = el("div", "labdice");
  s.append(el("output", "labseed", "seed " + seed));
  const re = key("⟳", "labre", () => {
    seed = (seed % 9999) + 1;
    NONCE.clear();                      // a new seed is a new draft of everything
    build(); paint(); reaudition();
  });
  re.title = "reroll the seed";
  s.append(re);
  t.append(s);
  return t;
}

// THE PARENTS: the same chronological bank the genre menu deals ("organize the
// genres chronologically", with the era tint on each chip's dot), filtered to
// the anchors that HAVE a history — a function genre is a part, not a style,
// and the bench refuses one anyway.
function paintParents() {
  const s = section();
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
  wrap.append(paintBand(), paintNames(), paintKeep());
}

// THE BAND: the shape of the mix, and nothing about how it got that way. Only
// the two things a listener would call "the composition" get a picture — the
// kit (and its fill) as steps you can tap, and the instrument roster as
// chips you can cycle. Every other invented field still has its roll key
// (§6 of nukernel/lab.js, unchanged); it just does not get a paragraph
// explaining what it is for, or a value printed out to argue with — a roll
// is heard, not read.
function paintBand() {
  const s = section();
  const want = new Set(B.syn.invention.map(i => i.field));
  for (const f of LANEFIELDS)
    if (want.has(f) && B.cand[f]) s.append(materialRow(f, laneGrid(f, B.cand[f])));
  if (want.has("instr") && B.cand.instr != null)
    s.append(materialRow("instr", instrRow(B.cand.instr)));
  const rest = B.syn.invention.filter(i => !LANEFIELDS.has(i.field) && i.field !== "instr");
  if (rest.length) {
    const row = el("div", "labmore");
    for (const inv of rest) row.append(rollKey(inv.field, inv.why));
    s.append(row);
  }
  return s;
}
// ONE ICON, ONE TOOLTIP — the roll key's whole interface now. `title` carries
// what `.labp`/`.labmine`/`.labfseed` used to print: the field, whether a
// person already took it over, and the reason it is on the list at all.
function rollKey(field, why) {
  const b = key("⟳", "labroll" + (MINE.has(field) ? " on" : ""), () => rollField(field));
  b.title = (MINE.has(field) ? field + " — yours; roll again" : "roll " + field) +
            (why ? " — " + why : "");
  return b;
}
function materialRow(field, visual) {
  const inv = B.syn.invention.find(i => i.field === field);
  const row = el("div", "labmrow");
  row.append(rollKey(field, inv && inv.why), visual);
  return row;
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

// NOVELTY still answers ("is this a new genre or an old one wearing a hat?",
// nukernel/lab.js §3) — Keep's tooltip below reads it. It is no longer
// printed of its own accord: a verdict-and-neighbour-table paragraph is
// exactly the kind of analytical surface this pass removes.

// THE NAME: place-year offers, and a field to coin one of your own. The bench
// offers and never picks (§4 of lab.js), so nothing is filled in for you — and
// every offer is already checked against the labels the table holds. Why a
// name was offered is a tooltip now, not a line under the chip.
function paintNames() {
  const s = section();
  const chips = el("div", "pchips labnames");
  for (const n of B.names) {
    const b = el("button", "pchip gen" + (label === n.label ? " on" : ""), n.label);
    b.type = "button";
    b.dataset.name = n.label;
    b.title = n.why;
    b.setAttribute("aria-pressed", String(label === n.label));
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

// KEEP: the gate. What used to be printed under the key — the error count,
// the novelty verdict, the law each problem broke, in the law's own words —
// is now the key's own tooltip; a disabled key already says "not yet",
// title says why.
function paintKeep() {
  const s = section();
  const errs = B.problems.filter(p => p.level === "error");
  const warns = B.problems.filter(p => p.level === "warn");
  const k = key("+ Keep this genre", "go labkeep", () => {
    const r = keepCandidate(B.cand, { recipe: B.recipe });
    if (r.ok) paint();
  });
  k.disabled = !!errs.length || !label;
  k.title = errs.length
    ? errs.map(e => (e.field ? e.field + ": " : "") + e.msg).join("; ")
    : !label ? "name it first"
    : B.novelty.verdict + (warns.length ? " — " + warns.length + " to look at" : "");
  s.append(k);
  if (KEPT.length) {
    const kept = el("div", "pchips labkept");
    for (const e of KEPT) {
      // the RECIPE's name, not the table's: the installed anchor wears the
      // session mark (ui/state.js) and this shelf is already, entirely, the
      // song's own genres — marking them here would mark every chip on it
      const b = el("button", "pchip gen on", e.recipe.label);
      b.type = "button";
      b.dataset.kept = e.key;
      b.title = Object.keys(e.parents).join(" + ");
      b.addEventListener("click", () => {
        // reopen a kept genre on the bench: the RECIPE is all it ever was —
        // parents, seed, presses, hand edits — so it comes back on the bench
        // exactly as it went into the song, which is what makes a kept genre a
        // thing you can argue with rather than a thing you can only admire
        const r = e.recipe;
        PICK = Object.keys(r.parents);
        W.clear();
        for (const p of PICK) W.set(p, r.parents[p]);
        seed = r.seed | 0; label = r.label;
        MINE.clear(); NONCE.clear();
        for (const [f, n] of Object.entries(r.rolls || {})) NONCE.set(f, n);
        for (const [f, v] of Object.entries(r.mine || {})) MINE.set(f, v);
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
