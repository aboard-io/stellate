// ui/state.js — the store: the song, the selection, tempo and volume, the
// event bus, and every way a song enters or leaves the page (localStorage,
// a file off the desktop, adoptSong). STATE PUBLISHES, IT DOES NOT DRAW —
// no draw call and no element handle lives here except the one download
// anchor saveFile needs, which is file IO rather than rendering.
//
// Layer graph: deps -> THIS FILE -> derive -> audio -> ui views -> main.
// Audio modules may import state (they read the song and subscribe); state
// imports nothing but deps. Tempo and volume live HERE, not in the DOM —
// six functions used to re-read document.getElementById(...).value at call
// time, two of them in the audio hot path (stepDur per tick, barSec per
// channel build), which also made the loader untestable in node.
import { NuSong, GENRES, blank, emptyBox, DEFAULT, masterIsDefault,
         busesIsDefault, GROOVELABEL, SWINGLABEL, METERLABEL, INSTRCHOICES,
         POOLCHAIRS, BASSCHOICES, poolTakes, PARTNAMES } from "./deps.js";

export const DEFAULT_BPM = 126, NBOXES = 4;

/* ---------- the store ---------- */
// Exported as live bindings: importers see every reassignment. Mutation from
// outside goes through the setters below, because a module cannot assign to
// another module's binding — which is exactly the discipline we want anyway.
// The bank is VARIABLE (1..NSLOTS) now; a fresh page carries ONE phrase.
export let SLOTS = [blank()];
export let slot = 0;
export let SUBJ = SLOTS[slot];       // by reference: cell edits mutate the slot
export let SONG = Array.from({ length: NBOXES }, emptyBox);
export let viewSec = 0, loopOnly = null, pendingStart = null;
// VOLUME IS A DEVICE SETTING, NOT A SONG FIELD . It lives in its
// own key, restored at boot, written only by the volume fader — adoptSong
// never touches it, so Write/preset/reset stop yanking the room's level
// around. bpm stays a song fact on purpose: a song owns its tempo, nobody's
// song owns your speaker. Old saves still carry `vol`; the loader keeps
// accepting it (song.js) and this file ignores it on adopt.
const VOLSTORE = "nukernel.vol.v1";
const readVol = () => {
  try {
    // getItem is null on a fresh device and +null is 0, not NaN — read the
    // string first or every new browser boots MUTED (found the hard way: the
    // audio gate's whole genre sweep read 0.0000 RMS)
    const s = localStorage.getItem(VOLSTORE);
    if (s == null || s === "") return 80;
    const v = +s;
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 80;
  } catch (e) { return 80; }
};
export let bpm = DEFAULT_BPM, vol = readVol();
// THE TEMPO MOVES, AND THAT IS NOT A SETTING .
// A song's tempo map — a breakdown sitting under the tempo, a ritard into the
// outro, the drift underneath all of it — is DERIVED from the arrangement in
// ui/derive.js songBars, so it is a fact about the song and there is no chip
// for it: a per-section tempo control would be a metronome mark, which is the
// one thing Paul's law forbids. What lives here is the escape hatch, and it is
// a DEVICE setting like the volume, in its own key, never adopted from a song:
// somebody working against a grid (or a gate reading the unbreathed timeline)
// turns the breathing off for their machine, not for the record. Default on —
// the music breathes without anyone asking it to.
const RUBSTORE = "nukernel.rubato.v1";
const readRubato = () => {
  try { return localStorage.getItem(RUBSTORE) !== "0"; } catch (e) { return true; }
};
export let RUBATO = readRubato();
// THE MASTER BUS belongs to the SONG, not to the page (song.js says why), so it
// rides here with the boxes rather than in the audio tier: audio/desk.js reads
// it and the parent engine renders it, and neither owns it. null is the whole of
// the old behaviour — song.js normalizes an empty spec away, so there is one
// spelling of "no globals" for the absent-is-today branch to key on.
export let MASTER = null;
// …AND THE SHARED-BUS TRIMS beside it, on the same terms: the song's, not the
// page's, null = the engine's buses exactly as the state resolves them (song.js
// validates; audio/desk.js writes them onto the units the engine is handed).
export let BUSES = null;
// …AND THE MIX OFFSETS (the board's layer): a song-level map of channel ->
// offsets riding OVER the composed mix. The composer/WRITE and the section
// fields stay the "real" mix; what the mixer surface writes lands here, once,
// for the whole record — so a tweak does not revert at the next section.
// null = no offsets = byte-identical engine output (absent is today).
export let MIXER = null;
// …AND THE GROOVE : a song fact, the way the tempo is — one
// drummer for the record, not one per section. It was a box field once, and
// compose.js stamped the same value on every box, which was the tell. null is
// the grid. ui/derive.js reads it as an argument (it stays pure), the
// transport recompiles on "groove", the bounce re-renders, song.js migrates
// old per-box saves up to it.
export let GROOVE = null;
// …AND THE SWING, on the same terms (2026-08-16, "nothing in a section tells
// time"): a record swings or it does not — a per-section swing would be the
// drummer changing hands mid-song, and compose.js stamped one value on every
// box, the same tell the groove gave. null means the GENRE's own lean stands
// (swing is identity there — kernel.js g.swing); "straight" is the explicit 0
// that overrides it. ui/derive.js reads it as an argument, the transport
// recompiles on "swing", the bounce re-renders, song.js migrates old per-box
// saves up to it.
export let SWING = null;
// …AND THE METER, the third of the family, on exactly the same terms: a
// record counts in three or it does not. null is the four-four every record
// in this box has counted in since it existed; "three" and "six" are the two
// words fields.js METERLABEL names, and the NUMBERS behind them (steps and
// pulse) live in kernel.js METERS so a saved word and a live table cannot
// drift. The engine reads the meter off the GENRE (band-kit stamps
// `g.meter`, kernel.js and ui/derive.js read it); this is the SONG's record
// of the same fact — what survives storage, and what a reloaded session
// re-seats every chair from.
export let METER = null;
// …AND THE INSTRUMENT POOL :
// a song fact like all three above — the band is cast once, for the record,
// not re-auditioned per section. A map of CHAIR (fields.js POOLCHAIRS: the
// kernel's own roles plus the bass) -> instrument id (INSTRCHOICES), null
// meaning every chair plays the genre's own `instr` — absent is today, the
// same spelling law as MASTER/BUSES. ui/derive.js resolves it as an argument
// (instrIdOf: pool first, genre second — it stays pure), the transport
// recompiles on "pool" (the register home is decided per instrument), the
// bounce re-cuts the carrier, and song.js migrates the retired per-layer
// `instr` overrides up to it.
//
// IT IS A FACT THE PAGE CAN NOW SAY AND UNDO (2026-08-28). It could not, and
// the cost was measured twice in one day: a chair whose menu was silently
// outranked (ui/derive.js, THE DROPDOWN WAS NOT BROKEN) and a bass with no
// control at all (audio/plan.js seats a bass event at `POOL.bass` or nothing).
// `poolBand` / `poolSay` below are the readout, `hirePoolChair` /
// `firePoolChair` / `clearPool` are the writers, and `adoptSong` announces a
// band that arrives with a document. What is NOT here is a second store: this
// is still one map on the song, cleared by every entrance, and the surface is
// four pure functions over it.
export let POOL = null;

// …AND THE SONG'S OWN GENRES (2026-08-16, "a genre you invented is a genre the
// song can play"): the LAB's kept candidates, as RECIPES (song.js says why a
// recipe and not an anchor), keyed `lab.<slug>`. A song fact like the master
// bus and for the same reason — a genre invented for a record belongs to the
// record, and a shared song that plays a genre the recipient does not have is
// not a shared song.
//
// ONE LOOKUP PATH: the rebuilt anchors are INSTALLED IN THE LIVE GENRE TABLE
// under their session keys. Not a second table consulted first — the same
// object every module already reads, so a session genre is resolved by
// ui/derive.js `genreOf`, layered by the stack, seated by the mixer, cast by
// the pool, sorted into the genre menu at its coined year and bounced, with no
// module in the graph knowing there was ever a difference. The namespace is
// what makes that safe (song.js SESSION_NS): a `lab.` key cannot shadow an
// anchor, so "session first" and "catalog first" are the same order.
export let GENRESET = {};                 // session key -> recipe
// what the invented ones are MARKED WITH, everywhere at once. It goes on the
// LABEL rather than on a chip class because a genre is named in eight places —
// the menu, the stack line, the mixer's roster, the chyron, the file name — and
// a mark that lives in one bank's class table marks it in one of them. ✎ is
// the WRITE key's own glyph (ui/chrome.js): made here, not found.
// (the PREDICATE is song.js's — `NuSong.isSessionKey` — and stays there rather
// than being re-exported from here: the namespace is a fact about the save
// format, and the save format is that file's.)
const MARK = "✎ ";

export function setSlot(i) { slot = i; SUBJ = SLOTS[i]; }
export function putPhrase(i, p) { SLOTS[i] = p; if (i === slot) SUBJ = p; }
export function setViewSec(i) { viewSec = i; }
export function setLoopOnly(v) { loopOnly = v; }
export function setPendingStart(v) { pendingStart = v; }
export function setBpm(v) { bpm = +v; }
export function setRubato(v) {
  RUBATO = !!v;
  try { localStorage.setItem(RUBSTORE, RUBATO ? "1" : "0"); } catch (e) { /* private mode */ }
}
export function setVol(v) {
  vol = +v;
  try { localStorage.setItem(VOLSTORE, String(vol)); } catch (e) { /* private mode */ }
}
// one writer, and it normalizes THROUGH THE REGISTRY: a spec that asks for
// nothing the master bus recognizes becomes null, which is the same rule
// song.js applies on the way in — so the save shape and the graph's
// absent-is-today branch cannot disagree about what "unmastered" is.
export function setMaster(m) { MASTER = masterIsDefault(m) ? null : m; }
// same writer, same normalizer, for the rack: a spec that asks for nothing the
// rack recognizes becomes null, so "every knob cleared" and "never touched"
// are one state in the save and in the graph's as-built branch
export function setBuses(b) { BUSES = busesIsDefault(b) ? null : b; }
// ONE WRITER for the mix-offset layer. val == null (or 0 / false) deletes the
// field; an emptied channel and an emptied map normalize away, so "no offsets"
// keeps one spelling and the engine's absent-is-today branch stays reachable.
export function setMixOffset(chan, key, val) {
  const M = MIXER ? { ...MIXER } : {};
  const o = { ...(M[chan] || {}) };
  if (key === "eq") {
    if (val && typeof val === "object" && Object.keys(val).length) o.eq = val;
    else delete o.eq;
  } else if (val == null || val === 0 || val === false) delete o[key];
  else o[key] = val;
  if (Object.keys(o).length) M[chan] = o; else delete M[chan];
  MIXER = Object.keys(M).length ? M : null;
  emit("mix", { chan, key });
  save();
}
export const mixOffsetOf = chan => (MIXER && MIXER[chan]) || null;
export function clearMixOffsets() {
  if (MIXER == null) return;
  MIXER = null; emit("mix", {}); save();
}
// one writer for the song's groove, normalizing through the registry table the
// way setMaster does: anything GROOVELABEL does not name is the grid, spelled
// null — the same rule song.js applies on the way in
export function setGroove(g) {
  GROOVE = g != null &&
    Object.prototype.hasOwnProperty.call(GROOVELABEL, String(g)) ? g : null;
}
// ...and one for the song's swing, the same normalizer against its own table:
// anything SWINGLABEL does not name is "the genre's own lean", spelled null
export function setSwing(v) {
  SWING = v != null &&
    Object.prototype.hasOwnProperty.call(SWINGLABEL, String(v)) ? v : null;
}
// ...and one for the song's meter, the same normalizer against its own table:
// anything METERLABEL does not name is "count in four", spelled null
export function setMeter(v) {
  METER = v != null &&
    Object.prototype.hasOwnProperty.call(METERLABEL, String(v)) ? v : null;
}
// ...and one writer per CHAIR for the song's instrument pool, the same
// normalizer against its own two tables: a seat POOLCHAIRS does not name is
// ignored, an id INSTRCHOICES does not name (null included) clears the chair
// back to "the genre's own", and a pool with every chair cleared is null —
// one spelling of "no pool", the MASTER/BUSES law.
export function setPoolChair(chair, id) {
  if (!POOLCHAIRS.includes(chair)) return;
  const p = { ...(POOL || {}) };
  // ONE LAW FOR WHAT A CHAIR MAY BE HANDED, and it is fields.js `poolTakes`
  // rather than a second reading of INSTRCHOICES here — because the bass
  // chair's list is NARROWER than the pool's (fields.js BASSCHOICES) and a
  // live edit and a loaded file must not disagree about it. `glockenspiel` in
  // the bass chair was accepted by this line until 2026-08-28.
  if (poolTakes(chair, id)) p[chair] = id;
  else delete p[chair];
  POOL = Object.keys(p).length ? p : null;
}

/* ---------- THE BAND, SAID OUT LOUD -------------------------------------
   (Paul, 2026-08-28: "Fix the pool thing too.")

   THE POOL WAS A SONG FACT WITH NO READOUT AND NO CONTROL. It outranked
   what a chair played, it survived nothing and announced nothing, and its
   one writer — ui/band.js — is a module no page has loaded since band.html
   became index.html (measured 2026-08-28: the shipped page fetches
   ui/state.js and ui/derive.js and never ui/band.js). So a pool could only
   ever ARRIVE — carried by a document off the desktop, or lifted out of a
   pre-pool save by song.js's `instr` migration — and once it had arrived
   there was nothing on the page that said so and nothing that could undo it.
   That is the refusal law owed to a VALUE: a control that lost has to say it
   lost, and a band that was hired has to be firable.

   These four are the whole surface. `poolBand()` is the data — which chairs
   are overridden and by what — `poolSay()` is that data as one sentence,
   and `hirePoolChair` / `firePoolChair` / `clearPool` are the writers a tap
   calls. The writers COMMIT (setPoolChair above stays a pure normalizer):
   one tap is one edit, the transport recompiles on "pool", and a surface
   that has to remember to commit afterwards is a surface that will forget. */
export const poolBand = () => POOLCHAIRS
  .filter(c => POOL && POOL[c])
  .map(c => ({ chair: c, chairLabel: PARTNAMES[c] || c, id: POOL[c],
               label: INSTRCHOICES[POOL[c]] || POOL[c] }));
// the sentence, or null when the record's chairs are all playing their own —
// null and not "" so a caller can mount it with one `if`
export const poolSay = () => {
  const b = poolBand();
  return b.length ? "the band hired for this record: " +
    b.map(c => c.chairLabel + " \u2014 " + c.label).join(", ") : null;
};
// ...and what the bass chair may be handed, which is the one chair whose
// instrument the document cannot carry (fields.js BASSCHOICES says why)
export const bassChoices = () => ({ ...BASSCHOICES });
export function hirePoolChair(chair, id) { setPoolChair(chair, id); commit("pool"); }
export function firePoolChair(chair) { setPoolChair(chair, null); commit("pool"); }
export function clearPool() { POOL = null; commit("pool"); }

export const curSection = () => SONG[Math.min(viewSec, SONG.length - 1)];

/* ---------- the event bus ---------- */
// The typed-change vocabulary that replaced the copy-pasted redraw quartets:
//   "song"               a whole new song was adopted (file/composer/preset/
//                        reset/boot) — everything rebuilds, audio drops its mix
//   "phrase"             a phrase cell changed — editor/slots/arrange refresh,
//                        the song row does NOT (a scrub must not rebuild it)
//   "box"                the selected box changed musically — songrow patches,
//                        arrange re-renders, transport recompiles if playing
//   "selection"          viewSec/slot/focus moved, nothing musical changed
//   "transport"          bpm or volume moved
//   "master"             a master-bus global moved — the graph swaps its master
//                        chain, the bounce re-renders, the rack repaints
//   "buses"              a rack knob moved — the graph re-trims the shared
//                        returns (a param write, no swap), the bounce re-renders
//   "groove"             the song's groove moved — the transport recompiles
//                        (event times shift), the bounce re-renders the carrier
//   "swing"              the song's swing moved — same consumers, same reason
//   "pool"               a chair of the song's instrument pool moved — the
//                        transport recompiles (register homes are per
//                        instrument) and fetches what the new chair needs,
//                        the bounce re-cuts the carrier, the board relabels
//   "transport:state"    published by audio/live — playing flipped
//   "transport:section"  published by audio/live — the sounding box moved
//   "refresh"            assets finished loading mid-play; views re-render
//   "page"               published by ui/pages — the phone deck switched pages
//   "status"             {text} for the #readout line (readout.js listens)
const subs = new Map();
export function on(type, fn) {
  let a = subs.get(type);
  if (!a) subs.set(type, a = []);
  a.push(fn);
}
export function emit(type, detail) {
  const a = subs.get(type);
  if (a) for (const fn of a) fn(detail);
}
// commit: one call per user edit. Emits the typed change; persists the ones
// that change what a save would contain (selection is deliberately not saved).
export function commit(type, detail) {
  emit(type, detail);
  if (type === "phrase" || type === "box" || type === "transport" ||
      type === "master" || type === "buses" || type === "groove" ||
      type === "swing" || type === "pool") save();
}

/* ---------- the session genres: install, rebuild, keep ---------- */
// THE BENCH IS NOT ON THE BOOT PATH and must not be dragged onto it — it is
// ~123 KB of analysis tier behind ui/deps.js loadLab(), and most songs carry no
// invented genre at all. So this file never imports it: ui/lab.js hands the
// rebuilder in as it evaluates (a view registering a capability with the store,
// the same direction every subscription already runs), and a page served
// without the lab simply keeps the stand-ins.
let rebuilder = null;
export const useBench = fn => { rebuilder = fn; };

// THE STAND-IN, and it is the honest answer to a genuinely asynchronous fact.
// A song is adopted synchronously — derive.js indexes the genre table on the
// very next line, and a missing key throws — while rebuilding an invented
// genre needs a module that has not been fetched yet. So the dominant parent
// takes the part, wearing the coined name: a complete, playable, correctly-
// labelled anchor that sorts to the right year, is replaced in place the moment
// the bench arrives, and is what the genre STAYS if the bench refuses it. It is
// an understudy, not a placeholder — nothing downstream can tell, and nothing
// downstream has to wait.
const dominantOf = r => Object.keys(r.parents)
  .sort((a, b) => r.parents[b] - r.parents[a])[0];
function standIn(r) {
  const d = dominantOf(r);
  return { ...GENRES[d], label: MARK + r.label, parents: { ...r.parents } };
}
// the mark rides on the label of whatever the bench hands back, so the two
// paths cannot disagree about how an invented genre is named
const marked = (g, r) => ({ ...g, label: MARK + r.label });

function install(key, r) {
  GENRES[key] = standIn(r);
  if (!rebuilder) return;
  Promise.resolve()
    .then(() => rebuilder(r))
    .then(g => {
      if (GENRESET[key] !== r) return;      // the song moved on under us
      if (!g) throw new Error("the bench refused it");
      GENRES[key] = marked(g, r);
      // the definition just changed under a song that may be sounding: "box" is
      // the event for that — songrow patches, arrange re-renders, and the
      // transport recompiles if it is playing
      emit("box", { reason: "genre" });
    })
    .catch(() => {
      emit("status", { text: r.label + " could not be rebuilt — it plays as " +
        (GENRES[dominantOf(r)] || {}).label + ", its strongest parent", sticky: true });
    });
}
// adopt the song's genre set. ABSENT IS NOT EMPTY: a producer that omits the
// key (the composer, a preset, a save from before the lab existed) is saying
// "I know nothing about these", and the session's genres stay installed —
// otherwise pressing ✎ WRITE would silently strip the genre you just invented
// out of the table it was about to be composed with. An explicit map, `{}`
// included, is a document stating its own set, and replaces it.
function adoptSession(map) {
  if (!map) return;
  for (const k of Object.keys(GENRESET)) if (!map[k]) delete GENRES[k];
  GENRESET = { ...map };
  for (const [k, r] of Object.entries(GENRESET)) install(k, r);
}
// THE KEEP, from ui/lab.js: the candidate is already built and already
// validated there, so it goes straight into the table and the recipe goes into
// the song. Returns the key it took, which is the name the box will carry.
export function keepGenre(recipe, genre) {
  const key = NuSong.sessionKey(recipe.label, GENRESET);
  GENRESET[key] = recipe;
  GENRES[key] = marked(genre, recipe);
  saveNow();
  return key;
}

/* ---------- persistence ---------- */
// The song survives a reload; Reset all wipes it. Only plain data is stored —
// genre and transform names are STRING KEYS, never the operator functions — so
// the saved shape does not depend on the kernel's internals.
//
// The paranoia lives in song.js — migrate() climbs every older shape to the
// current one, validateSong() names the first field it refuses — and this
// file only APPLIES the result. The storage key deliberately keeps its old
// name: it names the slot, not the schema; migrate owns versions.
const STORE = "nukernel.song.v1";
let saveTimer = null;
function writeStore() {
  try {
    localStorage.setItem(STORE, JSON.stringify(
      { v: NuSong.VERSION, slots: SLOTS, song: SONG, master: MASTER,
        buses: BUSES, mix: MIXER, groove: GROOVE, swing: SWING, meter: METER,
        pool: POOL,
        genres: GENRESET, bpm }));
  } catch (e) { /* private mode, or quota: not worth interrupting the music */ }
}
export function saveNow() { clearTimeout(saveTimer); saveTimer = null; writeStore(); }
// Debounced during editing so a drag does not write on every frame — but
// FLUSHED when the page goes away, or an edit made in the last quarter second
// before a reload is simply lost.
export function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeStore, 250); }
addEventListener("pagehide", saveNow);
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});
export function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); }
  catch (e) { return null; }
}
export function clearStore() {
  try { localStorage.removeItem(STORE); } catch (e) { /* nothing to clear */ }
}

// the fresh page: ONE phrase — the starter, already written and already
// switched on in box 1 — and NBOXES Simple boxes. Built as a raw save so it
// enters through the same door as everything else. The bank used to ship
// eight blanks and the box referenced none of them, which meant the very
// first thing PLAY did on a fresh page was refuse ("nothing to play"), with
// the position LCD parked on -- and the transport key dark: the machine's
// front door opened onto a silent room. A fresh page now SOUNDS.
export const defaultSong = () => {
  const song = Array.from({ length: NBOXES }, emptyBox);
  song[0].stack[0].slots = [0];
  return { v: NuSong.VERSION, slots: [deepDefault()], song,
           bpm: DEFAULT_BPM };
};
// the starter phrase is genre data (genres.js DEFAULT) and the store must
// never hand out the literal itself — a scrub would edit the table
const deepDefault = () => JSON.parse(JSON.stringify(
  { ...blank(), ...DEFAULT }));

/* ---------- adoptSong: the ONE entrance ---------- */
// localStorage, a file off the desktop, a shipped preset, the composer and the
// Reset button all come through here. The work is song.js's (migrate ->
// validate, pure and node-gated); this function assigns the result, resets the
// selection, and publishes "song" — audio drops its channels and stops via its
// own subscription, every view rebuilds via its own. The eleven-statement
// epilogue this replaces was copy-pasted four times and half-remembered a
// fifth (boot).
export let loadError = null;
export const loadErrorText = () => loadError
  ? " (" + loadError.path + ": got " + JSON.stringify(loadError.got) +
    ", want " + loadError.want + ")"
  : "";
export function adoptSong(raw, reason) {
  const res = NuSong.load(raw);
  if (!res.ok) { loadError = res.errors[0]; return false; }
  loadError = null;
  const s = res.song;
  // FIRST, BEFORE ANYTHING PUBLISHES: the genre table has to hold every key
  // this song's boxes name before a single view indexes it (derive.js genreOf
  // throws on a miss), so the session set is installed ahead of the assignment
  // that makes those boxes current.
  adoptSession(s.genres);
  SLOTS = s.slots; SONG = s.song; slot = 0; SUBJ = SLOTS[0];
  MASTER = s.master;                   // validateSong normalizes absent to null
  BUSES = s.buses;                     // same normalizer, same law
  // the board's offset layer: a document that carries one states it; any
  // adopt without one — WRITE included — clears the board. Offsets briefly
  // survived a recompose ("they are yours"), and the trap arrived in a day:
  // drums muted while auditioning one record silently followed every record
  // written after it ("New York 1976 sounds like bluegrass now… and it has
  // no drums", 2026-08-19). A new record gets a zeroed desk; trims travel
  // with the SONG they were set on, via its own saved `mix`.
  MIXER = s.mix != null ? s.mix : null;
  GROOVE = s.groove;                   // ...and the song's groove, same law
  SWING = s.swing;                     // ...and its swing, the same move made twice
  METER = s.meter;                     // ...and how it counts, the third of the three
  /* ...AND THE BAND, WHICH IS HIRED FOR THE RECORD AND NOT FOR THE BOX
     (2026-08-28). `s.pool` is null for every document that does not carry one
     — validateSong normalises absent to null, exactly as it does for the
     master bus — so this line is also the CLEAR, and it is the same seam and
     the same argument as `MIXER` eight lines up: picking a place and a year
     composes a NEW RECORD, and a band hired for the last one has no claim on
     it. A plain boot already starts with none, and a page where the atlas
     kept the band while the desk was zeroed would be a page with two laws.
     The counter-case — a hand that deliberately hires a player and then goes
     looking for a genre to hear them in — is answered by making the band
     SAYABLE (`poolSay` above) rather than by making it sticky: a silent
     inheritance is not that hand's intent, it is only what it looks like.
     Measured on the shipped page 2026-08-28, with `{lead: overdrive_guitar,
     bass: slap_bass}` in force: Enter on the Faisalabad mark and a full load
     of `#at=Faisalabad&y=1988` both land with `POOL === null`. */
  POOL = s.pool;
  viewSec = 0; loopOnly = null; pendingStart = null;
  if (s.bpm != null) bpm = s.bpm;
  // s.vol is deliberately NOT adopted — volume is the device's (VOLSTORE above)
  // WHAT THE LOADER CHOSE, said out loud. A note is not a refusal (song.js): a
  // box naming an invented genre this file no longer carries plays as `simple`
  // rather than taking the whole song down, and the one thing that must not
  // happen is that it does so quietly.
  if (res.notes && res.notes.length)
    emit("status", { text: res.notes.length + " layer" +
      (res.notes.length > 1 ? "s" : "") + " named a genre this song does not " +
      "carry — " + res.notes.map(n => n.got + " → " + n.chose).join(", "),
      sticky: true });
  /* ...AND A BAND THAT ARRIVED WITH THE DOCUMENT IS ANNOUNCED, because the
     one thing the pool must never do again is steer a chair quietly. A
     document off the desktop can carry a `pool`, and song.js's `instr`
     migration LIFTS one out of a pre-pool save, so "the page cannot write
     one" is not the same as "one cannot arrive". Sticky, like the genre note
     above and for the same reason: it is a fact about the record you are now
     holding, not a flash. `poolSay()` is null on every record that hires
     nobody, which is every record this page composes.

     AND THE HONEST PART: THE "status" BUS HAS NO SUBSCRIBER ON THIS PAGE
     TODAY. Measured 2026-08-28 — `readout.js` (named in the bus vocabulary
     above) is not loaded by index.html, and grep finds no `on("status")`
     anywhere in ui/. So this emit currently lands where the genre note four
     lines up lands, which is nowhere, and that is a gap in the VIEW and not a
     reason to publish the fact from somewhere else: the store publishes, the
     view draws, and the day one line subscribes BOTH notes appear. It is
     written down here rather than left to be rediscovered, and
     test/pool.browser.js prints whether the sentence has reached the rendered
     page rather than asserting that it has. */
  if (poolSay())
    emit("status", { text: poolSay() + " \u2014 they outrank what those chairs " +
      "would otherwise play; clear them to hear the record's own", sticky: true });
  emit("song", { reason: reason || "load" });
  save();
  return true;
}

/* ---------- desktop ---------- */
export function songJSON() {
  // `genres` is written ALWAYS, empty map included — a file states its own
  // genre set, and the absent-is-"I don't know" reading adoptSession applies is
  // for producers inside this session, never for a document leaving it
  return JSON.stringify(
    { v: NuSong.VERSION, slots: SLOTS, song: SONG, master: MASTER,
      buses: BUSES, mix: MIXER, groove: GROOVE, swing: SWING, meter: METER,
      pool: POOL,
      genres: GENRESET, bpm },
    null, 1);
}
export function saveFile() {
  const names = [...new Set(SONG.flatMap(b => (b.stack || []).map(e => e.g)))]
    .join("-") || "song";
  const blob = new Blob([songJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "nukernel-" + names + "-" + SONG.length + "box.json";
  // the anchor must OUTLIVE the click: removing it in the same tick cancelled
  // the download in chromium and nothing was ever written
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export function loadFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let raw = null;
    try { raw = JSON.parse(fr.result); } catch (e) { raw = null; }
    if (!adoptSong(raw, "file"))
      emit("status", { text:
        "that file is not a nukernel song, or it is from an incompatible version" +
        loadErrorText(), sticky: true });
  };
  fr.readAsText(file);
}
