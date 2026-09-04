// audio/plan.js — the SCORE, compiled once, handed to the parent engine one bar
// at a time. This is the whole of what used to be audio/transport.js's 735-line
// scheduler: what survives is the two things the parent cannot know — which bar
// of nukernel's song is next, and who is playing in it — and everything the old
// file did with that knowledge (build nodes, ramp gains, tear them down) is now
// the parent's job.
//
// ONE TRANSLATOR, BOTH PATHS. audio/to-engine.js turns nukernel bars into the
// parent's {pitched,drums,found,sfx}; this file is the only thing that calls it,
// and both the live walk and whatever renders read the SAME per-bar answer out
// of it. That is not tidiness — the live page and the offline tape disagreeing
// about the same bar was the bug three separate times (the desk missing from the
// tape, a different 606 on each path, velocity meaning a filter here and a fader
// there). Two callers of one function cannot have that argument.
//
// THE SHAPE OF THE HANDOFF, because it decides everything below:
//
//   compile()    walks the song ONCE — ui/derive.js songBars for the notes, the
//                register home for the octaves, audio/to-engine.js for the
//                translation — and keeps a per-bar slice of the result.
//   barBeats(n)  how long bar n is, in beats. The parent's walk asks this per
//                bar (live.js `opts.barBeats`) because nukernel's tempo map
//                warps every bar by its own ratio and a rounded grid would put
//                the rubato back.
//   barPlan(n)   that bar's events, rebased to beat 0, plus the unit table with
//                the desk applied. The parent takes it from there: scheduling,
//                voice pools, the ring, the buses, the master chain.
//
// THE CAST IS THE SONG'S, NOT THE BAR'S. Every seat any box ever fills gets one
// parent unit, for the life of the compile. That is what keeps the unit table's
// TOPOLOGY constant across a box change — the parent crossfades a whole new
// stream when the module set moves (live.js sigOf), and a song that changed
// bands every four bars would spend its life bridging. What DOES move per bar is
// level, pan, sends and tone, and none of those are in the signature, so the
// desk rides in on a glide (stream-renderer feedBar applies changed params to
// the persistent procs and the DSP smooths them).
import { GENRES, BASSSYNTH, BASS_INSTR, instrOf, throatOf, voicedAs,
         VOICINGS, homeFor } from "../ui/deps.js";
import { SONG, SLOTS, GROOVE, SWING, POOL, RUBATO, loopOnly, bpm } from "../ui/state.js";
import { gid, songBars, poolInstrOf, kitOf } from "../ui/derive.js";
import { toEngine, samplerLibFor, recipeFor } from "./to-engine.js";
import { deskUnits, deskAmp, deskSweeps, voiceRoster,
         barEchoSec, songEchoSec } from "./desk.js";
import { isSynthFont, fontDef } from "./fonts.js";

/* ---------- the parent, loaded once ---------- */
// The engine ships as CLASSIC scripts that publish onto `window` (CLAUDE.md:
// genre-kernel merges __GENRES/__REGISTRY at load, so order is load-bearing).
// kernel-daw.html already carries three of them; the rest arrive here, by
// dynamic import, in the parent's own order. A guard skips anything the page
// already defined so nothing is re-executed under the app's feet.
const ROOTDIR = new URL("../../", import.meta.url).href;
const FAUSTDIR = new URL("../../engine/faust/", import.meta.url).href;
// A BROWSER GETS A GLOBAL; NODE GETS A MODULE. The engine ships UMD — it
// assigns to `window` in a page and to `module.exports` under a CommonJS
// loader — so a pure-node gate importing this file would otherwise wait
// forever for a global that is never written. Take whichever arrived, and
// publish it, so everything downstream reads one name.
const need = async (g, url) => {
  const W = typeof window !== "undefined" ? window : globalThis;
  if (!W[g]) {
    const m = await import(url);
    if (!W[g]) W[g] = (m && (m.default || m)) || W[g];
  }
  return W[g];
};
let depsP = null;
export function deps() { return depsP || (depsP = loadDeps()); }
async function loadDeps() {
  // THE PARENT'S MOUTH, NOT ITS BRAIN. This box brings its own genres, its own
  // arranger and its own tempo map; the parent is consumed strictly as a sound
  // engine (state → units → schedule → audio). Three loads used to sit here out
  // of habit and were measured dead — 683 KB and ~100 ms of blocking boot:
  //   * genres-data.js (645 KB, the parent's 274 anchors) — zero reads anywhere
  //     in nukernel; genre-kernel only walks it inside resolve/track/blend/
  //     deriveMind, none of which this box calls. genre-kernel's init still
  //     wants the key to exist, so a 20-byte stub stands where 645 KB stood.
  //   * theory.js / pipes.js — csd-engine guards both (CsdTheoryRef/
  //     CsdPipesRef null-checks) and no nukernel state carries `theory` or
  //     `pipes`, so the branches were dead twice over. The stream worker loads
  //     its own copies regardless, so the renderer never saw these anyway.
  const W = typeof window !== "undefined" ? window : globalThis;
  if (!W.__GENRES) W.__GENRES = { GENRES: {} };
  await need("__REGISTRY", ROOTDIR + "engine/registry-data.js");
  const E = await need("CsdEngine", ROOTDIR + "engine/csd-engine.js");
  const K = await need("GenreKernel", ROOTDIR + "engine/genre-kernel.js");
  const SE = await need("FaustStateEngine", FAUSTDIR + "voices/state-engine.js");
  return { E, K, SE };
}
let D = null;                                    // set once deps() resolves
export async function warmEngine() { D = await deps(); return D; }

/* ---------- the register home ---------- */
// A WHOLE LINE MOVES, OR THE LINE BREAKS. Sixteen of the twenty-one voices that
// need a fold STRADDLE their instrument's window — rock's rhythm guitar writes
// MIDI 22..41 against a guitar window that starts at 40 — so a per-note fold
// would lift sixty-two notes an octave and leave two where they were. The
// intervals are the music; what may move is the octave the whole part sits in.
//
// THE WINDOW IS THE PARENT'S OWN. It used to be read off a nukernel copy of the
// instrument ranges beside a nukernel copy of the zone spans; it is now
// SE.INSTRUMENT_RANGE and the resolved unit's own stretch bounds, which is the
// same table the parent's per-note fold (state-engine mapEvents) uses as the net
// under this. Two copies of that table is how the page and the tape came to
// disagree about where a trumpet lives.
// ...AND THE FOLD ITSELF IS THE KERNEL'S NOW (2026-09-04, the singer-register
// round). `homeFor` and its two numbers moved to kernel.js, beside `fold`, the
// per-note version of the same sentence — because precompose.js §7d became a
// second caller when it started seating a sung chair where its throat actually
// sings it, and a fold with two implementations is a page and a tape that
// disagree about where a singer lives. Re-exported here under its old name so
// the audio layer's own address for it is unchanged.
const midiOfHz = (hz) => 69 + 12 * Math.log2(hz / 440);
// A VOICE HAS A COMPASS, AND IT USED TO BE THE ONE THING THIS COULD NOT SAY.
// This read `unit.sampler` and returned null for everything else — "a synth
// voice folds by its own law" — which was true and was not a law, it was the
// PER-NOTE fold and nothing above it. So a sung part got no whole-line home and
// every note wider than the throat was wrapped where it stood: measured on
// hymn, four parts 31 semitones wide against a 25-semitone throat came back
// with 44-51% of their intervals rewritten, which is why the most obviously
// vocal record in the catalogue was refused a singer.
//
// The window is still the PARENT'S OWN, exactly as it is for a sampler. A voice
// or synth unit declares `freqMin`/`freqMax` (state-engine pitchedUnit — the
// chorale and singer cases carry the voice type's compass verbatim), and the
// parent's per-note fold reads those two numbers and nothing else, with a 52 Hz
// floor for dx7 whose freq slider is compiled [50,1000]. Reading the same two
// here is what puts a throat under the whole-line law rather than beside it —
// and a model that declares no floor still answers null, so every synth that
// only ever had a ceiling folds exactly as it did.
export function windowOf(SE, unit) {
  if (!unit) return null;
  const s = unit.sampler;
  let lo = -Infinity, hi = Infinity;
  if (s) {
    const R = SE.INSTRUMENT_RANGE && SE.INSTRUMENT_RANGE[s.id];
    if (R) { lo = R[0]; hi = R[1]; }
    if (s.stretchMinHz > 0 && s.stretchMaxHz > 0) {
      lo = Math.max(lo, midiOfHz(s.stretchMinHz));
      hi = Math.min(hi, midiOfHz(s.stretchMaxHz));
    }
  } else {
    const fmax = unit.freqMax;
    const fmin = unit.freqMin != null ? unit.freqMin : (unit.dx7 ? 52 : 0);
    if (!(fmax > 0) || !(fmin > 0)) return null;
    lo = midiOfHz(fmin); hi = midiOfHz(fmax);
  }
  if (!isFinite(lo) || !isFinite(hi)) return null;
  // an octave is the floor: a window narrower than twelve semitones cannot hold
  // every pitch class, so the fold would start refusing notes in key
  return hi - lo >= 12 ? [lo, hi] : null;
}
export { homeFor };

/* ---------- HOW THE VOCAL CHAIRS ARE REALISED — A VIEW (2026-08-28) ------
   Paul: *"I want to be able to choose whether to use synthesized voices or
   instrumentation to replace voices. Put this as a multi-state toggle right
   next to the main volume slider: Vox (default), Instruments, All analog,
   All FM."*

   THIS IS WHERE IT LIVES, and the whole of the answer to "is it an axis?" is
   in the three lines below: ONE module-scoped string, no store, no document
   key, no save, no share link, no migration. It is a view over the CAST — the
   same kind of thing as the room slider in the strip beside it — and `castOf`
   is the only reader, which is what makes it cheap to have and cheap to
   withdraw.

   WHY THE CAST AND NOT THE SCORE: nothing about the music moves. The vocal
   line is the same notes, in the same register, with the same words on it; what
   changes is the SEAT it is played from. That is also why the swap has to be
   here rather than in the document — `castOf` is the one place that resolves a
   seat, and a document rewrite would make the choice a fact about the record
   and lose it on the next `rewrite`.

   IT DOES NOT PERSIST, deliberately, and the cost is stated in fields.js
   VOICINGS: reload and you are back on `vox`. A setting that survives a reload
   is a setting somebody has to be able to see they made.

   `vox` IS ABSENT-IS-TODAY. instruments.js `voicedAs` answers null for it, the
   seat is untouched, and the compile is byte-identical to a build with no
   toggle. */
let VOICING = "vox";
export const voicing = () => VOICING;
export function setVoicing(v) {
  VOICING = (v && VOICINGS[v]) ? v : "vox";
  return VOICING;
}

/* ---------- the cast: who plays what, across the whole song ---------- */
// Resolved exactly the way the score resolves it — the pool cast wins over the
// genre's signature synth, the synth FONT wins over both, and `instrOf` names the
// chair's sampled instrument. A second opinion about any of those is a band that
// is not the one on screen.
function castOf(bars) {
  const seats = [];                  // global voice index -> { chair, instr, synth, tone, vox }
  const ix = new Map();              // recipe key -> global index
  // WHICH DESK TRACK EACH UNIT ANSWERS TO, per box. The cast is the SONG's, so a
  // unit key is song-wide; a desk address (fields.js chairKeys — lead / pad2 /
  // bass / drums) is the BOX's, and the same guitar is `lead` in one box and
  // `line2` in the next. So the mapping is per box and the desk is asked with it.
  const addr = new Map();            // si -> { unitKey: partKey }
  const rosters = new Map();
  const font = isSynthFont() ? fontDef().synth : null;
  // ...AND ITS FIVE VOICE WORDS (2026-08-28). `vox` is the LAYER'S — dark/warm/
  // open/bright/screaming, soft/hot/on the edge, snap/drone — and it belongs in
  // the seat KEY for exactly the reason `tone` and `synth` already are: two
  // layers that differ only in how their filter is set are two different
  // sounds, and folding them onto one seat would play both on whichever the
  // walk saw first. In the key they are two units, resolved once each, for the
  // life of the compile — which is the whole argument for wiring the words per
  // LAYER instead of per note: "the cast is the song's, not the bar's", and a
  // setting is a cast fact. (Absent-is-today is free: a record that writes no
  // vox adds an empty segment to every key, so every seat, its index and its
  // unit are byte-identical to before. Held on ten anchors.)
  const seatFor = (chair, instr, synth, tone, vox) => {
    const key = chair + "|" + instr + "|" + (synth ? synth.dsp : "") + "|" + (tone ? JSON.stringify(tone) : "")
      + "|" + (vox ? JSON.stringify(vox) : "");
    let v = ix.get(key);
    if (v == null) { v = seats.length; ix.set(key, v); seats.push({ chair, instr, synth: synth || null, tone: tone || null, vox: vox || null }); }
    return v;
  };
  for (const bar of bars) {
    const sec = SONG[bar.si];
    if (!sec) continue;
    let A = addr.get(bar.si);
    if (!A) { addr.set(bar.si, A = { drums: "drums" }); rosters.set(bar.si, voiceRoster(sec)); }
    const roster = rosters.get(bar.si);
    for (const e of bar.ev) {
      if (e.kind === "line") {
        const owner = e.layer || gid(sec);
        const vi = e.lv == null ? e.v : e.lv;
        const over = poolInstrOf(sec, owner, vi, POOL);
        const G = GENRES[owner] || {};
        // A CHAIR MAY BRING ITS OWN THROAT. `G.synth` is the record's
        // signature and it is one spec for the whole band, which is wrong the
        // moment two voices are different instruments — a cantor is a singer
        // and a schola is a chorale, and they are two Faust models. The
        // chairs seam already carries a chair's instrument and its tone; this
        // is the third thing it can carry. Absent, the genre's own stands and
        // nothing moves.
        const chSeat = Array.isArray(G.chairs) && G.chairs.length
          ? (G.chairs[vi % G.chairs.length] || null) : null;
        const gsyn = font || (over ? null : ((chSeat && chSeat.synth) || G.synth));
        // lineOnly: the riding lead swaps to the signature synth, the chord under
        // it stays sampled — the score's own predicate, verbatim
        /* ...AND IT DOES NOT RESTYLE A RECORDING (2026-08-31). Measured while
           giving industrialbreaks the sample-collage its own `wants` has asked
           for since the row was written: the chair seated `found:vox_a` and
           came out as `lead_fuzz` with no sampler at all, because the row
           declares a signature synth and the signature took the chair. Right
           for an INSTRUMENT — a signature exists so the anchor's machine plays
           its lines — and wrong for a `found:` id, which is a recording of a
           thing that happened. Apollo capcom traffic cannot be re-voiced as a
           fuzz lead; it can only be played or not. Excluded on the same footing
           the score's own `signed()` excludes a voice. Without this, no row
           with a signature synth could hire a sample at all, which is part of
           why one row of 377 ever used the crate. */
        const seatInstr = String(over || instrOf(owner, vi) || "");
        const useSyn = !!(gsyn && !/^found:/.test(seatInstr) &&
                          !(gsyn.lineOnly && e.pad && !font));
        const chair = e.pad ? "pad" : "line";
        // A CHAIR'S SEAT CARRIES THE CHAIR'S OWN TONE. `G.tone` is one tone
        // for the whole genre, and on a genre that seats two chairs (the
        // band's `chairs` seam) it is the KEYS' — which handed the driven
        // guitar's seat a keys tone, and (with the instruments already
        // merged by the role pool) folded both chairs into ONE seat key.
        // The chair's declared tone outranks it; a genre without chairs is
        // byte-identical.
        const ch = chSeat;
        // ...AND A THROAT, WHERE THE RECORD NAMED NONE (2026-08-28).
        // "SOLO VOX shows up everywhere." Measured over all 201 anchors at
        // seed 1: 369 vocal chairs, and 201 of them sang one of TWO
        // signatures, because 173 anchors state no `tone.mouth` and a vocal
        // id with no mouth falls to PATCH_VOICE's ONE row per GM id — one
        // throat for Lagos, Nashville and Vienna alike. instruments.js
        // `throatOf` casts one from the record's own idiom (the place and
        // year in its label, and its family) out of the thirty measured
        // throats genres.js MOUTHS already carries.
        //
        // IT IS MERGED ONTO THE TONE AND NOT PASSED BESIDE IT, because the
        // tone is the seat's IDENTITY (the key below): a lead and a section on
        // the same record are two throats and must be two seats, and two
        // records that share a tone block and not a label must not share a
        // singer. A genre that states its own `mouth` — nineteen anchors, and
        // every chair a band page has given a voice type to — is untouched
        // and renders byte-identically, which is the whole of the law here:
        // if a genre states its own, that wins.
        // ...AND THE VOICING VIEW, which may take the chair away from the
        // singer altogether (the toggle in the transport). It is asked with the
        // chair's own held/moving flag, because a section and a soloist are
        // replaced by different things — instruments.js `voicedAs` owns which.
        const vcd = voicedAs(VOICING, owner, over || instrOf(owner, vi), e.pad);
        const seatTone = (ch && ch.tone) || G.tone || null;
        const throat = (seatTone && !seatTone.mouth)
          ? throatOf(owner, over || instrOf(owner, vi)) : null;
        // `e.vox` is what ui/derive.js sectionEvents tagged this note's LAYER
        // with (voxAll — the layer's own chip, else the box's, knob by knob).
        // It is read here and nowhere downstream: by the time the words are on
        // a seat they are a patch, and the scheduler has nothing left to do
        // with them.
        // the view outranks the record's own signature for THIS chair only —
        // "all FM" means the singer is on FM, not that the Minimoog under it
        // is; every other seat resolves exactly as it did.
        const useSyn2 = vcd ? !!vcd.synth : useSyn;
        // THE CHAIR'S OWN WORDS, UNDER THE LAYER'S (2026-08-28). `ch.vox` is
        // what the DOCUMENT said about this voice's sound — the three sampler
        // words, document.js `toGenre` -> `chairs[v].vox` — and `e.vox` is what
        // a LAYER chip said about this note's stack entry. Merged knob by knob
        // with the layer on top, which is the same law ui/derive.js `voxOf`
        // already states for a layer against its box: a chip set in one place
        // must not throw away the one it was inheriting. Both absent is null,
        // and null is byte-identical to every compile before this.
        // ...AND THE VIEW'S OWN WORDS UNDER THE HAND'S (2026-08-30, the
        // grace-run fix). `vcd.vox` is instruments.js clamping a melismatic
        // line's taker articulate (voicedAs clause b — the words reach the
        // sampler's atk/rel ports and a synth's attack/release alike). It
        // sits OVER the document's chair words (the view outranks the
        // record's signature for this chair, exactly as `useSyn2` above
        // already rules for the synth) and UNDER the layer's chip (`e.vox` —
        // a word the hand set on the page must not be quietly rewritten by a
        // toggle). vox mode and every non-melisma chair carry no `vcd.vox`,
        // so this line is byte-identical for all of them.
        const vcdVox = (vcd && vcd.vox) || null;
        const seatVox = (ch && ch.vox) || vcdVox || e.vox
          ? { ...((ch && ch.vox) || null), ...vcdVox, ...(e.vox || null) } : null;
        // ...AND THE VIEW MAY WRITE ON THE TONE (2026-08-30, the `chorus`
        // position). `vcd.tone` is instruments.js saying something about HOW
        // this chair is realised that only the seat can carry — today it is
        // the one word `recorded`, which audio/to-engine.js `voiceForInstr`
        // reads as "decline", dropping the chair out of the patch chain and
        // into the sampler library. It sits OVER the record's own tone and
        // the cast throat for the same reason `useSyn2` does: the view
        // outranks the record's signature for THIS chair. The four older
        // positions carry no `vcd.tone`, so this line is byte-identical for
        // vox / instr / analog / fm alike.
        const baseTone = throat ? { ...seatTone, mouth: throat } : seatTone;
        e._seat = seatFor(chair, vcd ? vcd.instr : (over || instrOf(owner, vi)),
                          vcd ? (vcd.synth || null) : (useSyn ? gsyn : null),
                          (vcd && vcd.tone) ? { ...baseTone, ...vcd.tone } : baseTone,
                          seatVox);
        e._syn = useSyn2;
        const r = roster.find((x) => x.v === e.v);
        if (r) A["v" + e._seat] = r.key;
      } else if (e.kind === "bass") {
        const bs = BASSSYNTH[sec.bassop] || null;
        // THE BASS CHAIR CAN BE TOLD WHAT IT SOUNDS LIKE. Every other chair
        // hands its genre's `tone` down; the bass handed null, so a synth
        // bass ran on to-engine's defaults (cutoff 1400, decay 0.4) in every
        // genre there is — no filter of its own and a gate as long as the
        // note. It is `bassTone` rather than `tone` on purpose: absent, this
        // is byte-identical for all 110 genres, and a genre that wants its
        // bass shaped says so.
        // the bass takes the BOX'S words (derive.js tags a bass event with
        // `voxAll(sec, null)` — a bass line belongs to the box, not to one
        // layer's stack entry), and a sampled upright simply owns none of the
        // five and is untouched.
        /* WHO THE BASS IS, AND THE RECORD GETS THE FIRST WORD (2026-09-02,
           slice 2c). This read `(POOL && POOL.bass) || BASS_INSTR` and the
           bass was the one chair on the page with no control at all — the
           tombstone at avail.js `sound.bassinstrument` carried the whole
           argument and named this line as the third of its three. The bass
           VOICE now carries an `instrument` and document.js `toGenre` spreads
           it here as `bassInstr`, so the DOCUMENT outranks the session's pool
           hire for exactly the reason a line's `chairs[v].instr` does: the
           record is the thing that is saved, shared and reopened, and the pool
           is a fact about this sitting. Absent is today twice over — no
           document names one until a hand says so (precompose writes none), so
           `POOL.bass` is still what every existing record and every
           `hirePoolChair("bass", …)` reaches. */
        const bRow = GENRES[e.layer || gid(sec)] || {};
        e._seat = seatFor("bass", bRow.bassInstr || (POOL && POOL.bass) || BASS_INSTR, bs,
                          bRow.bassTone || null, e.vox || null);
        e._syn = !!bs;
        A["v" + e._seat] = "bass";
      }
    }
  }
  return { seats, addr };
}

/* ---------- the compile ---------- */
let TL = [];                 // the bar list
let BARS = [];               // per bar: { beats, pitched, drums, si }
let UNITS = {};              // the cast's unit table (topology-constant)
let KITS = {};               // kit name -> that kit's copy of it
let STATE = null;            // the parent state the units were resolved from
let UNROUTED = [];
let ADDR = new Map();        // box index -> { unit key: the desk address it answers to }
let HOMES = [], SEATS = [];  // the cast, and the octave each seat was moved by
let totalBeats = 0;

export const timeline = () => TL;
export const barCount = () => BARS.length;
export const unitTable = () => UNITS;
export const parentState = () => STATE;
export const unrouted = () => UNROUTED;
export const stepDur = () => 60 / bpm / 4;
export const songDurSec = () => TL.reduce((s, b) => s + b.barSteps, 0) * stepDur();
// the register decision the last compile made, per seat — a shift nobody can
// see is a shift nobody can check (the old window.__nuHome, kept)
export const homes = () => HOMES.slice();
// WHICH SEAT IS WHOSE. A pitched event names its voice ("v0"), and until the
// band page seated a keys player beside the bass nothing had to ask which
// was which — one pitched voice needs no map. A gate reading "the bass" off
// the first pitched event it finds is a gate that will lie the moment a
// second chair sits down, so the cast says who it is.
export const cast = () => SEATS.map((s, i) => ({ v: "v" + i, chair: s.chair,
  instr: s.instr, synth: !!s.synth, tone: s.tone || null,
  strip: stripOf("v" + i) }));
/* THE CHANNEL STRIP, SO AN EXPORT CAN QUOTE THE DESK INSTEAD OF GUESSING IT.
   Paul, of the exported set: "you're choosing instruments but just giving them
   default settings ... Could you sculpt the sound more to be appropriate and
   then use the sends?" Every exported track sat at unity with both sends at
   -inf, because the exporter had no channel to read — and the engine has had
   one all along: deskUnits sums `fader`, `rev`, `del` and `pan` per unit and
   the renderer plays exactly that. This hands the same four numbers out.

   THE FIRST BOX IS THE STRIP. These four are per BAR in the engine, because a
   send can ride inside a section; a Live track's mixer is one value. Box 0 is
   the honest single answer and the ride stays in the engine — the alternative
   is automation envelopes, which is P3 and named as such in the als.js header.

   ABSENT IS UNITY, deliberately: deskUnits omits `fader` where the chair asks
   for no move, so a `{}` strip means "this channel is untouched" and every
   reader may treat a missing key as the default rather than as zero. */
export function stripOf(v) {
  if (!BARS.length) return null;
  const p = barPlan(0);
  const u = p && p.units && p.units[v];
  if (!u) return null;
  const out = {};
  for (const k of ["fader", "rev", "del", "pan"]) if (u[k] != null) out[k] = u[k];
  return Object.keys(out).length ? out : null;
}
/* THE KIT IS ONE TRACK IN LIVE AND FOUR CHANNELS HERE. kick/snare/hat/tom each
   carry their own strip; an export that folds them into one Drum Rack has to
   pick, and the kick is the pick — it is the lane that is always present (a
   kit without a kick is not a kit), so this never returns the strip of a lane
   that happened to exist in one genre and not the next. The per-lane pans the
   other three carry are LOST in that fold, and that loss is the drum rack's to
   fix, pad by pad, not the track mixer's. */
export const drumStrip = () => stripOf("kick") || stripOf("snare");
export const seats = () => SEATS.slice();
export const barBeatsAt = (n) => (BARS.length ? BARS[((n % BARS.length) + BARS.length) % BARS.length].beats : 4);
// THE WARM SET, NAMED BY THE CALLER (the parent's opts.warmSrcs seam): every
// sampler zone the song's whole cast references — the unit table is topology-
// constant and already spans every kit — resolved to the crate entries the
// one STATE carries. This is the foreign-composer half of the parent's own
// buildSchedule enumeration: without it the stream routes bake every sampled
// bar against an empty buffer table and the record arrives as its synth
// minority ("like you inverted the mix", 2026-08-19).
export function warmSources() {
  if (!STATE) return { foundSrcs: [], samplerSrcs: [], speechSrc: null };
  const byId = {};
  for (const src of (STATE.foundSources || [])) byId[src.id] = src;
  const wants = new Set();
  const takeUnits = (units) => {
    for (const u of Object.values(units || {}))
      if (u && u.sampler) for (const z of (u.sampler.zones || []))
        if (z && z.srcId && byId[z.srcId]) wants.add(z.srcId);
  };
  takeUnits(UNITS);
  for (const t of Object.values(KITS)) takeUnits(t);
  return { foundSrcs: [], samplerSrcs: [...wants].map((id) => byId[id]), speechSrc: null };
}

/* ---------- the section's own clock: PACE (2026-08-30) ----------------------
 * ui/derive.js:697 declared, on purpose: "There is no per-section tempo
 * control and there will not be one: the tempo is a fact about the SONG."
 * REVERSED 2026-08-30, the five-walls round — the dated reversal now lives
 * where the sentence does (ui/derive.js, under the tempo-map header), as a
 * reversal must; this block keeps the CLOCK's half of the story. Jingju
 * banshi, the cavatina/
 * cabaletta, the nuba's acceleration and vilambit-to-drut are records whose
 * FORM is a tempo shape, and that sentence refused all four at the door. The
 * reversal keeps the sentence's TRUTH: the record still has ONE bpm (the
 * fence per record — fields.js BPM_LO/BPM_HI, which read 70..160 when this
 * was written and read 40..220 since 2026-09-02 — engine spb = 60/bpm on
 * both paths — live.js:259
 * and export/wav.js:185) and the engine never learns a second one. A paced
 * section stretches its bars in BEATS, which is the rail the tempo map
 * already rides: the parent walk asks `barBeats` per bar and the press bakes
 * `baseSec += beats * spb` off the same BARS table, so bar SECONDS move at
 * the PCM on both paths with the engine's clock untouched.
 *
 * THE WORD IS COMPOSE'S, THE NUMBER IS THE CLOCK'S — the split lvl/LEVELS
 * made (compose deals `lvl`, audio/desk.js knows its dB). compose.js PACES
 * is the ladder; this table is what each word is worth, as a TEMPO
 * multiplier, proportional the way the mensural signs were (dupla,
 * sesquialtera): a `half` verse plays at half the record's bpm, so its bars
 * take twice the seconds — vilambit is half the record's own base, drut is
 * double, and the base still fences (fields.js BPM_LO..BPM_HI).
 *
 * WHY HERE AND NOT IN warpBars: the tempo map (ui/derive.js) is the record
 * BREATHING — ±1.2% role leans, seam gestures, drift — and it must keep
 * summing to the song the arrangement wrote. Pace is a section-sized STEP the
 * ear is meant to hear as a step (banshi is a ladder, not a lean), applied
 * after the breathing so the breathing rides the paced bar unchanged.
 * Everything in the bar scales together — barSteps (the clock), the events'
 * offsets and durations, and the box's own boxSteps sum so the automation
 * ratio (barPlan's boxNom/boxSteps) stretches a lane over the section it
 * hears. `steps`/boxNom keep the GRID, exactly as warpBars leaves them.
 *
 * ABSENT IS TODAY, to the byte: a bar whose section says no word takes no
 * multiplication at all — not even ×1, so no float can wobble.
 */
const PACE_RATE = { half: 0.5, slow: 0.75, steady: 1, push: 1.5, double: 2 };
function paceTL(tl) {
  for (const bar of tl) {
    const sec = SONG[bar.si];
    const r = sec && sec.pace != null ? PACE_RATE[sec.pace] : null;
    if (r == null || r === 1) continue;            // no word, or the word for 1
    const k = 1 / r;
    bar.barSteps *= k;
    if (bar.boxSteps > 0) bar.boxSteps *= k;       // uniform over the section
    for (const e of bar.ev) {
      e.off *= k;
      if (e.dur > 0) e.dur *= k;
    }
  }
}
export const paceRateOf = (w) => (w != null && PACE_RATE[w] != null ? PACE_RATE[w] : 1);

// PURE over the current state: build the bar list, the cast and the translation.
// Runs on every musical edit while playing (the "something changed" law), so it
// must be a walk and nothing else — no fetch, no context, no node.
export function compile() {
  TL = songBars(SONG, SLOTS, GROOVE, SWING, loopOnly, { rubato: RUBATO });
  paceTL(TL);
  // does ANY box name a section echo time? — the one question barFx asks, asked
  // once per compile rather than once per bar (barPlan runs on the pump's clock)
  SONG_HAS_DTIME = SONG.some((b) => b && b.dtime != null);
  let beat0 = 0;
  for (const bar of TL) { bar.beat0 = beat0; beat0 += bar.barSteps / 4; }
  if (!D || !TL.length) { BARS = []; UNITS = {}; KITS = {}; STATE = null; totalBeats = 0; return TL; }
  const { E, K, SE } = D;
  const { seats, addr } = castOf(TL);
  ADDR = addr;

  // ---- the register home, one decision per seat over the WHOLE song ----------
  // The old walk decided per BOX; the cast is the song's, so the decision is too
  // — and a chair that keeps its instrument across a key change keeps its octave
  // with it, which is what stopped a bridge sounding an octave off its verse.
  // THE PROBE IS THE TAPE'S OWN RESOLUTION, not a second opinion about it. It
  // used to ask the sampler library directly, which answered `ahh_choir` with a
  // recording of a choir while the tape seated the same chair on voice_choir —
  // so the line was moved to fit a window the engine was never going to use.
  // to-engine.recipeFor is the one chain (signature synth, then the patch the
  // GM id photographs, then the sampled default), and it is what recipeFor's
  // own caller uses one line later.
  const lib = samplerLibFor(K, 1).samplerLib || {};
  const probe = seats.map((s) => {
    const r = recipeFor(s.chair, s, lib, []);
    return SE.pitchedUnit(s.chair === "bass" ? "bass" : r.role, r.m,
                          { bpm, seed: 1, sampledOnly: true });
  });
  // EVERY SEAT WITH A WINDOW GETS A HOME, whatever is making the sound. The
  // `_syn` exclusion here said "a synth folds by its own law" and was the other
  // half of windowOf's old refusal; with the window honest, a model that
  // declares no floor still answers null and still gets home 0, and the ones
  // that declare a compass — the throat above all — move whole.
  const notesOf = new Map();
  for (const bar of TL) for (const e of bar.ev)
    if (e._seat != null && e.n != null) {
      let a = notesOf.get(e._seat); if (!a) notesOf.set(e._seat, a = []);
      a.push(e.n);
    }
  const home = seats.map((s, v) => homeFor(notesOf.get(v) || [], windowOf(SE, probe[v])));
  HOMES = home; SEATS = seats;
  for (const bar of TL) for (const e of bar.ev)
    if (e._seat != null && e.n != null) e.home = home[e._seat] * 12;

  // ---- the translation: once per KIT ----------------------------------------
  // ONE KIT PER TRANSLATION, because the parent's drum lanes are named — kick,
  // snare, hat, tom — and its own mapper reads those names for the choke law,
  // the hat's three zones and the tom's repitch. Namespacing them per box would
  // break every one of those. So a song with two kits is two passes, identical
  // in the cast and different in the drums, and the box that changes kit changes
  // the unit table's SIGNATURE — which is the parent asking for a crossfade,
  // which is exactly what a new drummer is.
  const rb = TL.map((bar) => ({ ...bar,
    ev: bar.ev.map((e) => (e._seat == null ? e
      : { ...e, kind: "line", v: e._seat, part: seats[e._seat].chair,
          n: e.n == null ? null : e.n + (e.home || 0) })) }));
  const kitAt = TL.map((bar) => kitOf(SONG[bar.si]) || "");
  const kits = [...new Set(kitAt)];
  KITS = {}; UNROUTED = []; STATE = null;
  let pitched = null;
  const drumsByKit = {};
  for (const kit of kits) {
    // every bar is present so the beat arithmetic is the song's; the bars that
    // are not this kit's simply carry no hits
    const bars = rb.map((b, i) => (kitAt[i] === kit ? b : { ...b, ev: b.ev.filter((e) => e.kind !== "hit") }));
    const t = toEngine({ bars, bpm, seed: 1, kit: kit || null,
      seat: (v) => seats[v] || null,
      // the room is the DESK's: toEngine's own master-fx defaults would put a
      // second reverb and a second delay under a song that already says how wet
      // each box is (desk.js, the send mapping)
      reverb: 0, delay: 0 }, { SE, K, E });
    KITS[kit] = t.units;
    drumsByKit[kit] = t.ev.drums;
    for (const u of t.unrouted) UNROUTED.push({ ...u, kit });
    if (!STATE) { STATE = t.state; pitched = t.ev.pitched; totalBeats = t.ev.totalBeats; }
    // EVERY KIT'S WAVS, ON THE ONE STATE. The engine decodes a zone by looking
    // its source id up in `state.foundSources` (live.js kickSamplerBuf) — and a
    // source that is not there when the zone is first asked for is cached as
    // unplayable and never retried. Keeping only the first kit's crate is
    // therefore not "the second kit is quiet", it is "the second kit is silent
    // for the rest of the session", which is precisely the shape of the bug this
    // whole round is about.
    else for (const src of (t.state.foundSources || []))
      if (!STATE.foundSources.some((x) => x.id === src.id)) STATE.foundSources.push(src);
  }
  UNITS = KITS[kits[0]];
  STRIPLOAD = trimStripLoad(KITS, TL);

  // ---- the per-bar slice -----------------------------------------------------
  // Every event carries an absolute beat; a bar owns [beat0, beat0+beats). A
  // groove that pushes the last sixteenth past the bar line keeps it in the bar
  // it was written in — the same clamp songBars makes.
  BARS = TL.map((bar, i) => ({ si: bar.si, first: bar.first, beats: bar.barSteps / 4,
                               kit: kitAt[i], beat0: bar.beat0, pitched: [], drums: [] }));
  const put = (arr, key) => {
    let i = 0;
    for (const e of arr) {
      while (i + 1 < BARS.length && e.beat >= BARS[i + 1].beat0) i++;
      while (i > 0 && e.beat < BARS[i].beat0) i--;
      BARS[i][key].push({ ...e, beat: e.beat - BARS[i].beat0 });
    }
  };
  put(pitched, "pitched");
  for (const kit of kits) put(drumsByKit[kit], "drums");
  for (const b of BARS) b.drums.sort((x, y) => x.beat - y.beat);
  return TL;
}

/* ---------- the strip load: what the renderer can actually finish in time ----
 * THE GLITCH OF 2026-08-20, AND WHY IT WAS INVISIBLE. Paul heard the waltz as
 * "just a pile of glitches"; the tape had 37 stretches of DIGITAL SILENCE, 61 to
 * 109 ms each, several a second. Nothing was wrong with the audio — measured, it
 * is cleaner than the shipping explorer's (crest 10.5 dB, 0.07 clicks/s, zero
 * dropouts in the frames that arrived). There was just NOT ENOUGH OF IT: the
 * AudioContext advanced 0.42 to 0.90 audio seconds per wall second on this box
 * while the parent's own explorer, same machine, same load, same engine, held
 * 0.99-1.00. A ring fed slower than it drains is heard as holes.
 *
 * WHERE IT GOES. sampler.js runs a whole channel strip PER NOTE — hpf, eq, sat,
 * comp, chorus, a four-stage phaser, a tape delay, each stage a per-sample kernel
 * with its own transcendentals — and then keeps stepping it through a ring-out
 * after the note ends so the delay line can empty. The explorer plays two to four
 * notes at once; a nukernel record is a BAND, and a chorale here is nine to twelve
 * sustained notes at once, every one of them dragging a full strip. Ablated on the
 * real page: with the strips off, btmv goes 0.47 -> 1.000 and the waltz 0.87 ->
 * 0.999. With only the MODULATION stages off — phaser, chorus, delay, leslie,
 * flange — and every tone stage kept, btmv 1.001, waltz 0.999, dox 1.000. The
 * tone is affordable; the modulation, times twelve, is not.
 *
 * WHY NOBODY SAW IT COMING. state-engine's CPU cost model charges a sampled voice
 * a flat SAMPLER_COST = 0.3 ("native PCM zone playback (no worklet) — cheap per
 * voice") and never looks at `sampler.strip` at all, so trimToBudget reads a
 * chorale at a third of budget and sheds nothing. Charging the strip there is not
 * the fix: measured over 274 anchors x 3 seeds, EVERY ONE of the 822 states
 * carries strips heavy enough to blow the same budget, and they all render in
 * real time in the explorer because they do not stack twelve of them. The load is
 * CONCURRENCY, and the only place that knows this record's concurrency is here.
 *
 * SO THE DESK TRIMS ITS OWN. This is nukernel's unit table, built by nukernel, so
 * a trim here cannot move one sample of a parent render — every explorer/daw/press
 * state is byte-identical by construction, because none of them comes through this
 * function. Deterministic, no rng: cost each unit's modulation stages by the most
 * notes that unit ever sounds at once, and if the record is over the ceiling, drop
 * modulation stages heaviest-unit-first, in a fixed key order, until it is under.
 * Tone stages (hpf/lpf/eq/eq2/sat/comp) are never touched. A record under the
 * ceiling keeps every stage and is byte-identical to before this existed.
 */
const MOD_STAGES = ["phase", "chorus", "delay", "leslie", "flange"];
// MEASURED on the four study records (realtime ratio = audio seconds the
// AudioContext advanced per wall second, headless chromium, this box):
//   abide  load  2 -> 0.997-1.001   (never starved; must not lose a stage)
//   waltz  load 14 -> 0.866-0.904
//   dox    load 20 -> 0.420-0.701
//   btmv   load 20 -> 0.425-0.588
// With the modulation stages ablated outright the same three read 0.999 (waltz),
// 1.000 (dox), 1.001 (btmv); with THIS trim in place they read 0.997 / 0.986 /
// 1.001, and abide — under the line, so untouched — 1.000.
// The line is ALL-OR-NOTHING per record on purpose: trimming unit-by-unit was
// measured to plateau — btmv trimmed from load 20 to load 4 still only reached
// 0.79-0.82, because the cost of the last stacked voice is not proportional to
// its stage count. A record either has the headroom for its modulation or it
// does not, and the ear would rather have a dry chorus than a hole in the bar.
const STRIP_CEILING = 6;
let STRIPLOAD = null;
export const stripLoad = () => STRIPLOAD;
function trimStripLoad(kits, tl) {
  // the most notes a seat ever sounds at once, as the score writes it: a pad
  // chord is three events on one beat, and three strips
  const simul = new Map();
  for (const bar of tl) {
    const at = new Map();
    for (const e of bar.ev) {
      if (e._seat == null || e.n == null) continue;
      const k = e._seat + "@" + Math.round(e.t * 1000);
      at.set(k, (at.get(k) || 0) + 1);
    }
    for (const [k, c] of at) {
      const v = +k.slice(0, k.indexOf("@"));
      if (c > (simul.get(v) || 0)) simul.set(v, c);
    }
  }
  const rows = [];
  for (const kit of Object.keys(kits).sort()) {
    for (const key of Object.keys(kits[kit]).sort()) {
      const u = kits[kit][key];
      if (!u || key.slice(0, 2) === "__" || !u.sampler || !u.sampler.strip) continue;
      const mods = MOD_STAGES.filter((m) => u.sampler.strip[m]);
      if (!mods.length) continue;
      const v = key[0] === "v" ? +key.slice(1) : NaN;
      const n = Number.isFinite(v) ? Math.max(1, simul.get(v) || 1) : 1;
      rows.push({ kit, key, u, mods, n });
    }
  }
  const load = rows.reduce((s, r) => s + r.mods.length * r.n, 0);
  const dropped = [];
  if (load > STRIP_CEILING) {
    for (const r of rows) {
      // the unit table came out of the parent's own resolver — copy before
      // writing, so nothing upstream ever sees a mutated strip
      const strip = { ...r.u.sampler.strip };
      for (const m of r.mods) delete strip[m];
      r.u.sampler = { ...r.u.sampler, strip };
      dropped.push(r.kit + "/" + r.key + ":" + r.mods.join("+") + " x" + r.n);
    }
  }
  return { load, ceiling: STRIP_CEILING, trimmed: dropped.length > 0, dropped };
}

/* ---------- the handoff ---------- */
// set by compile(): whether the record uses the box-scoped echo time at all
let SONG_HAS_DTIME = false;
// how long bar n is, in beats — the parent's walk asks per bar
export const barBeats = ({ serial }) => barBeatsAt(serial);

// bar n, in the parent's own language, with the desk on it.
export function barPlan(n) {
  if (!BARS.length) return null;
  const i = ((n % BARS.length) + BARS.length) % BARS.length;
  const b = BARS[i];
  const sec = SONG[b.si];
  const A = ADDR.get(b.si) || { drums: "drums" };
  // AUTOMATION IS WRITTEN ON THE GRID AND HEARD ON THE TAPE. A lane's beats are
  // the box's NOMINAL beats; the bars it plays over have been warped by the
  // tempo map. One ratio carries a lane onto the box the ear is hearing — the
  // same ratio the old armAutomation used, and the reason it existed.
  const bar = TL[i];
  const ratio = bar.boxSteps > 0 ? (bar.boxNom || bar.boxSteps) / bar.boxSteps : 1;
  const b0 = (bar.beat0 - boxStartBeat(i)) * ratio;
  const boxBeatOf = (beat) => b0 + beat * ratio;
  const amp = deskAmp(sec, A, boxBeatOf);
  const pitched = [], drums = [];
  for (const e of b.pitched) {
    const g = amp(e.voice, e.beat);
    if (g > 0) pitched.push(g === 1 ? e : { ...e, amp: e.amp * g });
  }
  for (const e of b.drums) {
    const g = amp("drums", e.beat);
    if (g > 0) drums.push(g === 1 ? e : { ...e, amp: e.amp * g });
  }
  return { ev: { pitched, drums, found: [], sfx: deskSweeps(sec, b.beats, boxBeatOf),
                 srcById: {}, totalBeats: b.beats },
           units: deskUnits(KITS[b.kit] || UNITS, A, sec, boxBeatOf, D && D.SE),
           // THE BAR'S OWN MASTER-STAGE OVERRIDES (2026-08-28) — the third
           // thing a bar may carry, beside its notes and its units, and it
           // exists for exactly one word so far. See barFx below for the whole
           // law; `null` is the answer for every record that has never named a
           // section's echo time, and a null key is never written.
           ...(barFx(sec) || {}) };
}
// THE SECTION'S ECHO TIME, AS A PER-BAR fx_bus WRITE (2026-08-28).
//
// `bar.fxParams` is the parent's own port for this (stream-renderer feedBar:
// "master-stage (fx_bus) param glide — changed keys only, applied to the
// persistent proc so the change takes effect from this bar's first block"), and
// the rack's echo knob has ridden it once a bar since the rack was built. What
// is new is that a BOX may now name the length for its own bars.
//
// ANY BOX, THEN EVERY BAR. `SONG_HAS_DTIME` is compiled once: if no box in the
// song names a `dtime`, this returns null and not one bar carries an `fx` key —
// the handoff is byte-identical to every render before this existed, which is
// the absent-is-today law. The moment ONE box names one, EVERY bar carries an
// explicit answer, because the glide writes only CHANGED keys: a bar that fell
// silent after a "1/2" bar would keep playing at 1/2, and the same bar would
// then sound different depending on what preceded it. An explicit fallback is
// what makes the record the same on every play and from any starting bar.
function barFx(sec) {
  if (!SONG_HAS_DTIME) return null;
  const own = sec && sec.dtime != null ? barEchoSec(sec.dtime) : null;
  return { fx: { dtime: own != null ? own : songEchoSec() } };
}
/**
 * WHAT THE ENGINE WILL ACTUALLY DO WITH A CHANNEL, keyed by the desk address.
 *
 * The engineer's grey-outs are derived from THIS and from no table of their
 * own, so the board's refusals and the renderer's are the same refusal:
 *   * `stereo` — audio/desk.js widthKept drops every insert on a wide unit
 *     (render-core folds a chained unit to channel 0), so a character chip on
 *     the schola is silently discarded. The board says so instead.
 *   * `sampled` — WHICH RENDERER PLAYS THIS VOICE, and nothing else any more.
 *     It used to be the board's EQ refusal: "desk.js writes the strip EQ only
 *     `if (u.sampler)` ... measured, `eq:{hi:4}` on the cantor changed
 *     nothing." That was true, and it was the DEFECT rather than the contract
 *     — audio/desk.js now carries the same merged EQ to a modelled voice at
 *     `u.strip`, which stream-renderer.js renderUnitWindow runs as a per-unit
 *     stage, so the engineer greys nothing on that account. The fact is kept
 *     because it still says which of the parent's two paths a chair takes,
 *     which is worth knowing; it is no longer a refusal.
 * BEFORE compile() HAS RUN THIS IS `{}`, and the view must fail OPEN — a
 * control that vanishes before boot is worse than one that is briefly
 * optimistic, and widthKept drops the chip either way.
 */
export function channelFacts(si) {
  const A = ADDR.get(si);
  if (!A) return {};
  const units = UNITS || {};
  const out = {};
  for (const [unitKey, chan] of Object.entries(A)) {
    const u = units[unitKey];
    if (!u) continue;
    out[chan] = { // WHICH ENGINE UNIT THIS CHAIR IS (2026-09-01). The other four
                  // fields say what the engine will DO with the channel; this
                  // says which unit key it is, so a reader holding a chair can
                  // ask the handle for that unit's own measurement
                  // (voiceRms) or find it in the bar audit's `voices` table.
                  // Without it every caller re-walked ADDR by hand.
                  unit: unitKey,
                  stereo: !!u.stereo,
                  sampled: !!u.sampler,
                  module: u.module || null,
                  instr: (u.sampler && (u.sampler.id || u.sampler.instr)) || null };
  }
  return out;
}
/* WHO ANSWERS TO WHICH CHAIR, FOR ONE BOX (2026-09-01).
   `ADDR` — unit key ("v0", "v3", "bass", and the seeded "drums") -> the desk
   address that unit answers to ("lead", "pad2", "bass", "drums") — has been
   module-private since castOf built it, and `channelFacts` above was its only
   reader, which INVERTED it and threw the unit key away. That left the page
   with no way to ask "is the schola sounding" or "how loud is the schola":
   the schedule names voices ("v3") and every surface a hand touches names
   chairs ("schola"), and nothing joined the two.

   THE JOIN IS THE MAP ITSELF, so it is exported rather than re-derived. A COPY
   is handed out: ADDR is the compile's own record and a reader that mutated it
   would move a chair in the mix. `{}` before compile() has run — the same
   fail-open channelFacts documents above. */
export const addrOf = (si) => Object.assign({}, ADDR.get(si));
export const firstBarOfBox = (si) => TL.findIndex((b) => b.si === si && b.first);
// where the box this bar belongs to STARTED, in song beats — the automation
// lanes are written in box beats and the tempo map has already moved them
function boxStartBeat(i) {
  let j = i;
  while (j > 0 && TL[j].barIn > 0) j--;
  return TL[j].beat0;
}
