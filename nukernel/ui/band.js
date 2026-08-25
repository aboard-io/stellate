// nukernel/ui/band.js — THE STATE, PRINTED. No document, no controls, no
// staff: one <pre> holding the app state as indented JSON.
//
// (Paul, 2026-08-23, verbatim: "Get rid of all HTML and show me the app
// state as indented JSON. Use a pretty printer.")
//
// WHY THIS IS NOT A LOSS. The page it replaces — headings, questions, a
// paragraph per answer, two staves, a circle of fifths, a producer's
// sentence builder — was a view that went and fetched the model seat by
// seat and then decided, in tables of its own, what it had. Since
// interview.js there is ONE VALUE that IS the document (the record as
// questions and answers, with the heading each question declares), and
// since vocabulary.js there is a machine-readable account of what can be
// said at all. A view can be generated from those. Nothing can be
// generated from a hand-typed page — which is what all that markup was.
// So: show the value. The next page is a function of it.
//
// THE PRETTY PRINTER is JSON.stringify's own indent argument, which is the
// pretty printer this platform ships and the one every other file in this
// tree already prints with (state.js songJSON). No dependency, no
// highlighter, no fold: <pre> is monospace by default and the window
// scrolls the document.
//
// WHAT IS STILL HERE, because it is not view: the record still compiles and
// still reaches the engine (`push`), the session still survives a reload
// (`remember`/`recall`), and the offline cache still warms. Nothing on this
// page starts the transport, because nothing on this page is a control.
// audio/live.js is untouched and `startAt(0)` from a console still plays
// what is printed.
const Band = window.NuBand;
const Interview = window.NuInterview;
const { toSong: toSong0 } = Band;
// THE PRODUCER IS ONE SEAM, AND THIS IS IT. nukernel/producer.js is a pure
// data-tier module like every other file below the UI — it reads the record
// band-kit already composed and moves it, and it is the only thing in the
// building that knows what "make the drums punk" means.
//
// One run per model, cached on the model's own identity (the model is
// immutable and replaced on every answer, so a WeakMap keyed on it is an
// exact cache). With no notes the run returns the sections it was handed,
// unchanged and by reference — which is what makes a record with no
// producer notes byte-identical to the record before the producer existed.
const Prod = window.NuProducer;
const PRODUCED = new WeakMap();
function produced(m) {
  let r = PRODUCED.get(m);
  if (!r) { const base = toSong0(m, MODES);
            r = Prod.run(m, base); r.base = base; PRODUCED.set(m, r); }
  return r;
}
const toSong = (m, MODES_, only) =>
  (only == null ? produced(m).secs : toSong0(m, MODES_, only));
import { GENRES, NuSong, MODES } from "./deps.js";
import { adoptSong, SONG, SLOTS, putPhrase, on, commit, setBpm, setSwing,
         setMeter, setPoolChair, setMixOffset, clearMixOffsets, vol } from "./state.js";
import { warmup, playing } from "../audio/live.js";
import { registerSW, warmCache, warmShell, warmed } from "../audio/offline.js";
import { toNotes } from "./abc.js";
import { zoneFilesFor } from "../audio/audition.js";

const $ = (id) => document.getElementById(id);

const GKP = "lab.band.";           // one session genre per section of the form
const MELP = "lab.idea.";          // ...and the melody's own, when somebody takes it
const VOXP = "lab.voice.";         // ...and the singer's, which is a layer too
// THE ROOM OPENS WITH A RECORD IN IT (2026-08-22, Paul: "The start again
// 'default' song should play and interpret the theme and its answer across
// a verse-chorus structure"). `Band.blank()` is still the empty room — the
// dice rolls from it and every gate measures from it — and `Band.opening()`
// is that room with the demonstration record already standing: verse,
// chorus, verse, chorus, the tune in the verses, the answer in the choruses
// and the last one back up a step. Nothing in it is answered, so the first
// question is still "when is it?".
let model = Band.opening();
model.bpm = 112;                   // a machine tempo: shorter bars, sooner changes

/* ---------- the model reaches the engine ---------- */
// the kit becomes a GENRE (kit.js toGenre) installed in the live table, and
// the song is four bars of it — which is every mechanism the engine already
// has for drums and no new one.
let ver = 0;
function push(first) {
  const song = toSong(model, MODES);
  song.forEach((s2, i) => { GENRES[GKP + i] = { ...s2.genre, __v: ++ver }; });
  // any genre from a longer previous form must stop being referenced —
  // to the BOX'S OWN CEILING, read off band-kit rather than written here a
  // second time (this loop is what that ceiling was pinned to)
  for (let i = song.length; i < Band.MAXSECS; i++) {
    delete GENRES[GKP + i]; delete GENRES[MELP + i]; delete GENRES[VOXP + i]; }
  // THE ONE ENTRANCE CARRIES A SKELETON; THE RECORD LANDS IN PLACE.
  // adoptSong validates a DOCUMENT, and this page's four phrase banks
  // (pattern/guitar/melody/voice per section) outgrow the daw document's
  // ceiling (fields.js NSLOTS) the moment a form has five sections — and a
  // form's "build"/"break" are this page's role words, not the loader's. A
  // full-record adopt was therefore REFUSED for a big roll, silently: SONG
  // kept the old record while GENRES already held the new one, and the
  // first compile across that seam read a section whose genre had been
  // swept. So the adopt does only the job `first` exists for — the session
  // reset: board, groove, pool, pins, typed errors still honest — carrying
  // a minimal legal skeleton, and the record itself always arrives the way
  // an answered question already arrives: in place, below.
  if (first) adoptSong({ v: NuSong.VERSION, bpm: model.song.bpm, genres: {},
    slots: [song[0].pattern],
    song: [{ ...NuSong.emptyBox(), stack: [{ g: GKP + 0, slots: [0] }],
             len: song[0].bars }] }, "band");
  // ...AND THE TEMPO IS THE PRODUCER'S TOO, within a fence. A tempo is too
  // strong a lever to hand a lerp — one press toward punk from 96 is +25.6
  // bpm, a whole catalog standard deviation, from one word about the drums
  // — so producer.js caps the move at 8% of the standing tempo per press.
  // With no notes this IS model.song.bpm, to the byte.
  setBpm(produced(model).bpm);
  setSwing(model.song.swing || null);
  // ...and how the record counts, the third song fact of the family. The
  // ENGINE reads the meter off each section's genre (band-kit stamps it);
  // this is the SONG's record of the same fact, which is what a saved
  // document round-trips and what song.js validates.
  setMeter(model.song.meter || null);
  setPoolChair("bass", model.bass.instr);
  // the pool casts by ROLE, and two chairs can want the same role — a jazz
  // date comps on the keys AND the guitar, both `stab`, and a role key can
  // only name one instrument. So the pool is NOT how this page's two pitched
  // voices resolve any more: the genre's `chairs` seam carries each chair's
  // own instrument per voice and derive.js poolInstrOf reads it first. The
  // row written here is the roster surface (and any reader without the
  // seam); where two chairs collide on one role, the one whose part it
  // actually is wins the label, and the guitar's roles are its own
  const kj = Band.Ky.JOBS[model.keys.job] || {}, gj = Band.Gt.JOBS[model.guitar.job] || {};
  for (const chair of ["pad", "stab", "riff", "counter", "line", "drone", "lead"]) {
    const mine = gj.part === chair ? model.guitar.instr
      : kj.part === chair ? model.keys.instr : null;
    setPoolChair(chair, mine);
  }
  // THE ENGINEER'S HAND ON THE DESK. Everything the fourth chair decides is
  // a mix OFFSET (ui/state.js MIXER, applied in audio/desk.js over the
  // composed mix), so the engineer needs no audio path of its own — it is
  // the same board the mixer page writes. Cleared and rewritten whole on
  // every push: what the engineer said IS the board on this page.
  // ...AND THE PRODUCER'S HAND LANDS ON THE SAME BOARD, added rather than
  // applied over: two answers on one channel ADD, the way two hands on a
  // board would, which is exactly what audio/desk.js already does with a
  // channel's several treatments.
  clearMixOffsets();
  const desk = Band.mixOf(model), pmix = produced(model).mix;
  for (const chan of new Set([...Object.keys(desk), ...Object.keys(pmix)])) {
    const a = desk[chan] || {}, b = pmix[chan] || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "eq") {
        const e = {};
        for (const band of ["lo", "mid", "hi"]) {
          const v = +(((a.eq || {})[band] || 0) + ((b.eq || {})[band] || 0)).toFixed(2);
          if (v) e[band] = v;
        }
        setMixOffset(chan, "eq", e);
      } else if (k === "mute") setMixOffset(chan, "mute", !!(a.mute || b.mute));
      else setMixOffset(chan, k, +(((a[k] || 0) + (b[k] || 0)).toFixed(3)));
    }
  }
  // THREE BANKS OF PHRASES, one per pitched thing: the keys, the guitar and
  // whatever melody is being picked up. derive.js walks phrase pi to voice
  // pi, so the order of a box's slots IS the order of its chairs.
  const NS = song.length;
  song.forEach((s2, i) => { putPhrase(i, s2.pattern); putPhrase(NS + i, s2.guitar); });
  for (let i = NS * 4; i < SLOTS.length; i++) putPhrase(i, NuSong.blank());
  // ...and the bank is exactly four per section, no holes: the skeleton
  // adopt starts it at one phrase, and a section without a melody or a
  // voice must still leave a blank where its slot would be
  for (let i = 0; i < NS * 4; i++) if (!SLOTS[i]) putPhrase(i, NuSong.blank());
  // ...and the MELODY is a layer of its own, with its own genre and its own
  // phrase: a two-bar tune cannot ride the bar clock the rhythm section
  // keeps (the kernel reads a phrase's own length AS the bar), so it gets a
  // stack entry rather than a voice.
  song.forEach((s2, i) => {
    if (!s2.melody) { delete GENRES[MELP + i]; }
    else { GENRES[MELP + i] = { ...s2.melody.genre, __v: ++ver };
           putPhrase(NS * 2 + i, s2.melody.phrase); }
    // ...and the singer, on a layer of their own for the same reason
    if (!s2.voice) { delete GENRES[VOXP + i]; }
    else { GENRES[VOXP + i] = { ...s2.voice.genre, __v: ++ver };
           putPhrase(NS * 3 + i, s2.voice.phrase); }
  });
  const boxes = song.map((s2, i) => ({ ...NuSong.emptyBox(),
    stack: [{ g: GKP + i, slots: [i, NS + i] },
            ...(s2.melody ? [{ g: MELP + i, slots: [NS * 2 + i] }] : []),
            ...(s2.voice ? [{ g: VOXP + i, slots: [NS * 3 + i] }] : [])],
    len: s2.bars, role: s2.role, cue: s2.role,
    // ...and the engineer's hand on THIS section: the box's own strip
    ...(s2.box || {}) }));
  // the form can change length, so the box list is replaced in place —
  // every push, `first` included (its adopt carried only the skeleton)
  SONG.length = 0; for (const b of boxes) SONG.push(b);
  commit("box"); commit("swing");
  commit("transport");
  // ONCE THE RECORD IS CALLED, IT IS YOURS: the samples this cast can ask
  // for are fetched once, and the service worker keeps them. After that the
  // record plays with the network off — the piano-audition zones for the
  // theme's own span included, so "hear it on the piano" works on a train.
  let extra = [];
  try {
    if (model.idea && model.idea.on) {
      const t = toNotes(Band.Id.toPhrase(model.idea), themeOpts(model, "a"));
      extra = zoneFilesFor(t.notes.map((x) => x.midi));
      // ...and the answer's own span, when there is one — a warmed record
      // plays BOTH its themes on the train
      if (model.ideaB && model.ideaB.on) {
        const t2 = toNotes(Band.Id.toPhrase(model.ideaB), themeOpts(model, "b"));
        extra = [...extra, ...zoneFilesFor(t2.notes.map((x) => x.midi))];
      }
    }
  } catch (e) {}
  warmCache(extra);
  remember();
}

/* ---------- what a theme's notes are, for the warm ---------- */
// The staff is gone; this is not the staff. toNotes needs the record's key,
// mode, register and meter to say which MIDI notes a theme is made of, and
// the offline warm above needs those notes to know which sample zones to
// fetch. Same options object the engraver used, minus the two fields that
// were only ever about ink (barsPerLine, maxHold).
const themeOf = (m, t) => (t === "b" ? m.ideaB : m.idea);
const themeOpts = (m, t) => ({
  key: Band.B.KEYS[m.song.key] || 0,
  // the arranger's colour answer included (band-kit modeKeyOf: unanswered,
  // minor is still dorian and major still ionian) — the warm and the
  // audition must not disagree with what toGenre hands the kernel
  mode: MODES[Band.modeKeyOf(m.song)],
  reg: Band.Id.regOf(themeOf(m, t) || m.idea),
  bpm: m.song.bpm,
  // HOW THIS BAR COUNTS — declared, not derived: twelve steps reduce to 3/4
  // and only 3/4, and a 6/8 record is the same twelve steps heard in two
  // (ui/abc.js meterOf says why). Absent = the 4/4 every record counted in
  // before there was a meter question.
  ...(Band.metOf(m.song)
      ? { stepsPerBar: Band.metOf(m.song).steps, abc: Band.metOf(m.song).abc,
          beam: Band.metOf(m.song).beam } : {}),
});

/* ---------- THE STATE, AS A VALUE ----------------------------------------
   Three parts, and the middle one is the whole former page:

     transport  what the room is doing — armed, sounding, at what tempo and
                what level. The two device settings (volume, and the tempo
                the ENGINE was handed, which is the producer's if a note
                moved it) rather than the ones a song remembers.
     record     what was said: band-kit's model, the document itself.
     interview  what was ASKED, and what every other answer would have been
                — interview.js interviewOf, seat by seat, grouped by the
                heading each question declares, plus the per-section rows.

   The SCORE (what gets played — toSong's event list, ~100 KB of it) is
   deliberately not here: it is derived from the record on every push and it
   is the engine's copy, not the app's state. `window.__bandScore()` prints
   it for anyone who wants to read it.

   interviewOf composes the record once per section to prune the offers
   (316–1,982 ms a section, measured in offer-identity.test.js), so it is
   cached on the model's own identity exactly as `produced` is — the model is
   immutable and replaced on every answer, so a WeakMap keyed on it is an
   exact cache and a re-print that answered nothing costs nothing. */
const INTERVIEWS = new WeakMap();
function interview(m) {
  let iv = INTERVIEWS.get(m);
  if (!iv) { iv = Interview.interviewOf(m, MODES); INTERVIEWS.set(m, iv); }
  return iv;
}
const state = () => ({
  transport: { on: !!model.on, playing, bpm: produced(model).bpm, vol },
  record: model,
  interview: interview(model),
});
// THE PRETTY PRINTER, and it is a real one rather than the indent argument.
// `JSON.stringify(v, null, 2)` has no idea what fits: it put each of the
// sixteen numbers of a drum vector on a line of its own, which is 9,203 lines
// of state most of which is a column of 1s and 0s. This is the classic
// fits-on-a-line rule (Wadler's `group`, in eight lines): a value whose flat
// spelling fits the width prints flat, and only what does not open up. A kit
// pattern is one line, the record it belongs to is a page.
//
// Two spaces, because that is what every other JSON this tree prints uses and
// a state you read on a phone should not indent itself off the screen.
const WIDTH = 88;
function pretty(v, ind) {
  const flat = JSON.stringify(v);
  if (flat === undefined) return "null";                    // a function, a symbol
  if (v === null || typeof v !== "object" || ind.length + flat.length <= WIDTH)
    return flat;
  const in2 = ind + "  ";
  if (Array.isArray(v))
    return v.length
      ? "[\n" + v.map((x) => in2 + pretty(x, in2)).join(",\n") + "\n" + ind + "]" : "[]";
  const ks = Object.keys(v).filter((k) => v[k] !== undefined);
  return ks.length
    ? "{\n" + ks.map((k) => in2 + JSON.stringify(k) + ": " + pretty(v[k], in2))
        .join(",\n") + "\n" + ind + "}"
    : "{}";
}
function dump() {
  const pre = $("dstate");
  if (pre) pre.textContent = pretty(state(), "");
}
// every typed change the store publishes re-prints, which is the whole of
// the redraw discipline now: the page is a pure function of the state, so
// there is nothing to patch and nothing to keep in sync
for (const ev of ["song", "box", "phrase", "transport", "master", "buses",
                  "mix", "groove", "swing", "pool", "transport:state"])
  on(ev, dump);

/* ---------- boot ---------- */
// the gate reads tempo as part of the artifact — the tempo the ENGINE is
// handed, which is the producer's if a note moved it and the arranger's
// otherwise (with no notes the two are the same number)
window.__nuTempo = () => produced(model).bpm;
// ...and what the producer has been told, and what it says it did. A gate
// asking "did the sentence move the record" has to read the ARTIFACT.
window.__bandProd = () => { const r = produced(model);
  return { notes: Prod.notesOf(model), mix: r.mix, bpm: r.bpm,
           said: r.said.map((x) => ({ sentence: x.sentence, w: x.note.w,
                                      said: x.said, moved: x.moved })) }; };
// THE SESSION SURVIVES A RELOAD, which is what makes the offline cache worth
// having: coming back to a dead network and being handed an empty room is
// the same as not having cached anything. One key, the model as it stands.
const SAVE = "nu.band.session";
function remember() {
  try { localStorage.setItem(SAVE, JSON.stringify(model)); } catch (e) {}
}
function recall() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    const m = JSON.parse(raw);
    if (!m || !m.on || !m.song || !m.drums || !m.bass || !m.keys) return false;
    model = { ...Band.blank(), ...m };
    // THE METER IS RE-SEATED FROM THE WORD, never trusted off the wire. A
    // saved session carries `song.meter` (one of the two words fields.js
    // METERLABEL names, or nothing); the two NUMBERS every chair counts by
    // are looked up fresh from the live table, so a tampered or stale `met`
    // on a chair cannot outlive the word that made it.
    model = Band.seatMeter(model, Band.metOf(model.song));
    return true;
  } catch (e) { return false; }
}

registerSW();
warmShell();
window.__bandWarm = () => warmed();               // the gate asks what is cached
window.__bandDraw = () => dump();                  // the gate times a re-print
window.__bandModel = () => JSON.stringify(model);   // ...and the model, so a
// word that is lost can be located: did the MODEL move, or only the plan?
window.__bandState = () => state();                // ...and the whole printed value
window.__bandScore = () => toSong(model, MODES);   // ...and what it plays, off the page
// ...AND THE ONE SEAM THAT MOVES IT. Every key that used to move this record
// was markup — count it in, roll a record, another take, a word answered on a
// chair's own sheet — and markup is what was removed, so the record would
// otherwise be frozen at whatever the session restored. This is the same four
// moves with no page around them: they answer, they push, and the print
// follows because the print is a function of the state.
//   __band.say("drums", "family", "a kit")   answer one question by its word
//   __band.roll()                            a whole record, answered at random
//   __band.take()                            the same record, played again
window.__band = {
  get model() { return model; },
  state, dump, push,
  say(seat, id, w) { model = Band.answer(model, seat, id, w); push(); dump(); return state(); },
  roll() { model = Band.randomSong(); push(true); dump(); return state(); },
  take() { const next = Band.anotherTake(model);
           if (next !== model) { model = next; push(true); dump(); } return state(); },
};
// ...and the session you left, if there is one. A cached record you cannot
// come back to is a cached record nobody hears twice.
recall();
push(true);
warmup();
dump();
