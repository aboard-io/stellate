// audio/transport.js — the scheduler and the clock: compile the song into a
// bar list, tick along it on the audio clock, start and stop. The TOP of the
// audio tier — it drives graph/assets/voices/mixer and reads state/derive,
// and it NEVER imports a ui view. Where the old tick() reached into the UI
// (showSection -> drawSong), it now PUBLISHES — "transport:state" when playing
// flips, "transport:section" when the sounding box moves, "status" for the
// readout line, "refresh" when assets land mid-play — and the views subscribe.
// The playhead animation reads getPosition() instead of the internals.
import { GENRES, DTIMES, BASSSYNTH, BASS_INSTR, STRIPS, stripFor,
         instrOf } from "../ui/deps.js";
import { SONG, loopOnly, pendingStart, setPendingStart, bpm, on, emit,
         SLOTS, GROOVE, SWING, POOL } from "../ui/state.js";
import { gid, stackOf, boxBars, kitOf, sectionRender,
         instrIdOf, poolInstrOf } from "../ui/derive.js";
import { ctx, initAudio, rmsNow, muteNow, unmuteRamp } from "./graph.js";
import { FONT, fontDef, isSynthFont, loadFont, specOf, zoneBufs, drumBufs,
         instrumentsInSong } from "./assets.js";
import { synthNodes, synthKey, loadSynth, focusSynths, playSynth, playSampled,
         playDrum, line, hit, synthDead, countDrop, playWindow } from "./voices.js";
import { channelFor, armAutomation, focusKit } from "./mixer.js";
import { setDelayTime } from "./graph.js";
import { playSyllable, warm as warmSing, needsWarm, singOff } from "./sing.js";

export let playing = false;
export let playingSec = -1;
let timer = null, nextBarTime = 0, nextBar = 0, passStart = 0;
// when the CURRENT pass of the whole song started, on the audio clock — the
// carrier element and MediaSession's positionState both need "where are we in
// the song", which passStart (per-SECTION) cannot answer
let loopStart = 0;

/* ---------- scheduler ---------- */
let TL = [];
// ==== REGISTER HOME ========================================================
// A WHOLE LINE MOVES, OR THE LINE BREAKS. The per-note fold in voices.js is the
// net under this; it cannot be the whole law here. Measured on the shipped
// table, sixteen of the twenty-one voices that need a fold STRADDLE their
// instrument's window — rock's rhythm guitar writes MIDI 22..41 against a
// guitar window that starts at 40, so a per-note fold would lift sixty-two
// notes an octave and leave two where they were. The intervals are the music;
// what may move is the octave the whole part sits in.
//
// So: one octave shift per (instrument, chair) per section, chosen to put the
// most notes inside the window and, among ties, to move the least. This is the
// parent's REGISTER HOME (csd-engine moves the line by octaves to fit the
// sampler's zone roots, contour intact) landing in the one place nukernel has
// that sees a whole line — the compile from section events into bars.
//
// The parent rejected phrase-level folding for a reason that does not bind
// here: live.js maps events through arbitrary beat windows, so a phrase
// straddling a window boundary would fold differently live than pressed. There
// are no such windows here — buildTimeline sees the section whole, and the
// bounce walks the same builder.
//
// It rides the event as `home` rather than rewriting `n`, and only the SAMPLED
// path reads it: a synth font's freq fold is its own law, and the tracker view
// keeps showing the note that was written. That makes a home-shifted voice a
// transposing instrument, which is what it is.
// WHEN IT FIRES: the parent's own threshold (csd-engine.js SAMPLER REGISTER
// HOME, REGISTER_FIT = 0.95) — a line homes whenever less than 95% of its
// notes sit inside the window and some whole-octave shift STRICTLY improves
// the fit; ties prefer the smaller move, so an already-fitting line never
// budges. This used to be far shyer (fire only when 60% out, land only when
// 90% in), which left the squeak Paul heard: ska's trumpet line straddled its
// ceiling — under half its notes above C6 — so the home never fired and the
// spill either played as squeak (inside the old soft edge) or per-note folded
// against the phrase's contour. The parent chose eager homing for exactly this
// case: "the mapping layer's per-note render fold saved the ear but bent
// phrase contours." Moving the whole line is the contour-preserving fix; the
// per-note fold (voices.js inRange) stays underneath as the net.
const HOME_MAX = 3;                                // ±3 octaves is already absurd
const REGISTER_FIT = 0.95;                         // the parent's threshold, verbatim
function registerHome(sec, ev) {
  const memo = new Map();                          // "owner|lv" -> octave shift
  // gather each chair's notes in one pass, then decide once per chair
  const notes = new Map();
  for (const e of ev) {
    if (e.kind !== "line") continue;
    const owner = e.layer || gid(sec);
    const key = owner + "|" + (e.lv == null ? e.v : e.lv);
    let a = notes.get(key);
    if (!a) notes.set(key, a = { id: instrIdOf(sec, owner, e.lv == null ? e.v : e.lv, POOL), n: [] });
    a.n.push(e.n);
  }
  for (const [key, a] of notes) {
    const spec = specOf(a.id), w = spec && playWindow(spec, a.id);
    if (!w || !a.n.length) { memo.set(key, 0); continue; }
    const inAt = k => {
      let inside = 0;
      for (const n of a.n) { const m = n + 12 * k; if (m >= w[0] - 0.5 && m <= w[1] + 0.5) inside++; }
      return inside;
    };
    const home = inAt(0);
    if (home >= REGISTER_FIT * a.n.length) { memo.set(key, 0); continue; }
    let best = 0, bestIn = home;
    for (let k = -HOME_MAX; k <= HOME_MAX; k++) {
      const inside = inAt(k);
      // strictly better, or as good and a smaller move: the tie-break is what
      // keeps an already-fitting line exactly where it was written (best
      // starts at 0, so a shift must beat the written octave outright)
      if (inside > bestIn || (inside === bestIn && Math.abs(k) < Math.abs(best))) {
        bestIn = inside; best = k;
      }
    }
    memo.set(key, best);
  }
  return memo;
}
// what the register home did, for the gates and the ?debug readout — a shift
// nobody can see is a shift nobody can check
const homeSeen = new Map();                        // "owner|lv" -> octaves moved
window.__nuHome = () => [...homeSeen.entries()]
  .map(([chair, oct]) => ({ chair, oct }));
// PURE over the current state: build and RETURN the bar list. The offline
// bounce walks its own copy of exactly this — one builder, or the carrier
// renders a different song from the one the transport plays.
export function buildTimeline() {
  const TL2 = [];
  const list = loopOnly == null ? SONG.map((s, i) => [s, i]) : [[SONG[loopOnly], loopOnly]];
  for (const [sec, si] of list) {
    const { g, bars, ev } = sectionRender(sec, SLOTS, GROOVE, SWING);
    // A BOX THAT PRODUCES NOTHING TAKES NO TIME. Since Simple became the default
    // there is no "empty" box any more, so a fresh page was four boxes of which
    // three had no phrase — one bar of music followed by three bars of silence,
    // for ever. A box with no events is skipped the way an empty one used to be.
    if (!ev.length) continue;
    const barSteps = 16 / g.rate;
    // ONE PASS into per-bar buckets. The old per-bar filter over the whole
    // event list was O(bars × events) per box — ~6M comparisons per compile on
    // a twenty-box song, and compile runs on every editor scrub while playing.
    //
    // GROOVE CAN PUSH THE LAST SIXTEENTH PAST THE BAR LINE, by design — that is
    // what a late note IS. Clamping the BUCKET rather than the time keeps the
    // event in the last bar with an offset a hair over a bar, and since bars are
    // scheduled in sequence with lookahead that lands it at exactly the right
    // moment instead of dropping it on the floor.
    const buckets = Array.from({ length: bars }, () => []);
    // the section's register homes, decided once over the whole event list
    // (see registerHome) and stamped on the events that carry a chair
    const home = registerHome(sec, ev);
    for (const e of ev) {
      const b = Math.min(bars - 1, Math.floor(e.t / barSteps));
      const hk = e.kind === "line"
        ? (e.layer || gid(sec)) + "|" + (e.lv == null ? e.v : e.lv) : null;
      const oct = hk ? (home.get(hk) || 0) : 0;
      if (hk && oct) homeSeen.set(hk, oct); else if (hk) homeSeen.delete(hk);
      buckets[b].push({ ...e, off: e.t - b * barSteps, home: oct * 12 });
    }
    for (let b = 0; b < bars; b++)
      TL2.push({ si, g, barSteps, first: b === 0, ev: buckets[b] });
  }
  return TL2;
}
export function compile() { TL = buildTimeline(); }
export const stepDur = () => 60 / bpm / 4;
// the song's REAL duration, in seconds, at the tempo as it is now — nukernel
// is the rare page that can tell MediaSession the truth instead of Infinity
export const songDurSec = () => TL.reduce((s, b) => s + b.barSteps, 0) * stepDur();
export function resetBar() { nextBar = 0; }

/* ---------- gesture hooks ---------- */
// startAt is the page's user gesture (the play button, a box click), and some
// machinery is only ALLOWED to exist inside one — the carrier <audio> element
// must be created and unlocked there or iOS refuses every later play(). The
// hooks run in startAt's synchronous prefix, before the first await, which is
// still inside the gesture's call stack. Registration instead of an import
// keeps the layer graph one-way (bounce imports transport, never the reverse).
const gestureFns = [];
export const onGesture = fn => gestureFns.push(fn);

/* ---------- the quiet tick ---------- */
// WHEN SOMETHING ELSE IS THE AUDIBLE PATH, SCHEDULING IS WORK NOBODY HEARS.
// On mobile the rendered carrier plays the song and the graph sits muted
// (audio/bounce.js) — and every bar this tick would schedule is a pile of
// nodes built, ramped and torn down for a bus at gain 0, on the one device
// where that CPU competes with the re-render that IS the sound. So the clock,
// the playhead and the section announcements keep running and the note
// scheduling stops. Registered rather than imported: transport must not know
// what a carrier is (bounce imports transport, never the reverse).
let quietFn = null;
export const setQuietWhen = fn => { quietFn = fn; };
const quiet = () => { try { return !!(quietFn && quietFn()); } catch (e) { return false; } };

/* ---------- the boot instrument ---------- */
// marks, not guesses — the parent added bootStats() because a phone hung
// forever at "scheduling the first bar" with zero errors and nobody could say
// which stage was stuck. firstSound is measured from a real analyser crossing
// (graph.rmsNow), never inferred from a timer.
const BOOT = {};
window.__nuBoot = () => ({ ...BOOT });
let soundPoll = null;
function watchFirstSound() {
  if (BOOT.firstSound != null || soundPoll) return;
  const t0 = performance.now();
  soundPoll = setInterval(() => {
    if (rmsNow() > 0.001) {
      BOOT.firstSound = Math.round(performance.now());
      emit("status", { text: "sounding — first sound " +
        Math.round(performance.now() - (BOOT.playPressed || t0)) + " ms after play" });
      clearInterval(soundPoll); soundPoll = null;
    } else if (performance.now() - t0 > 20000) { clearInterval(soundPoll); soundPoll = null; }
  }, 100);
}

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
    if (!clock) {
      clock = new Worker(new URL("../clock.js", import.meta.url));
      clock.onmessage = () => tick();
    }
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
  const mute = quiet();                            // the carrier owns the ear
  // the current section's channel, computed when the section changes rather
  // than re-derived (JSON.stringify and all) once per bar
  let cur = null;
  while (nextBarTime < look) {
    if (pendingStart != null) {                    // a queued jump lands on the bar
      const at2 = TL.findIndex(x => x.si === pendingStart && x.first);
      setPendingStart(null);
      if (at2 >= 0) nextBar = at2;
      emit("transport:section", { si: playingSec });
    }
    if (nextBar >= TL.length) nextBar = 0;
    const bar = TL[nextBar];
    const sec = SONG[bar.si];
    // channelFor gets nextBarTime as the retire clock: a spec change on the
    // SOUNDING box rebuilds its channel here, and the old one must ring out
    // until the bar the new one first receives — not die at ctx.currentTime
    // under everything already scheduled through it
    if (!mute && (!cur || cur.si !== bar.si || bar.first))
      cur = { si: bar.si, chan: channelFor(sec, nextBarTime), kit: kitOf(sec) };
    if (bar.first) {
      passStart = nextBarTime;
      if (bar.si !== playingSec) {
        // The playhead marks which box is SOUNDING. It must not move the
        // SELECTION — the selected box is what every palette click acts on, and
        // having playback steal it means a click lands on whatever bar happened
        // to be playing. So this is an announcement, not a state grab.
        playingSec = bar.si;
        emit("transport:section", { si: playingSec });
      }
      // the section's own echo time, and its transition, both land on the bar it
      // starts — a transition re-arms every pass, which is what makes it one
      if (!mute) {
        setDelayTime(DTIMES[sec.dtime || "d8"]);
        armAutomation(cur.chan, nextBarTime, bar.barSteps * sd * boxBars(sec), sd * 4);
        focusSynths(cur.chan, nextBarTime);   // this section's mix owns the synth pool
        focusKit(cur.chan, nextBarTime);      // ...and the one kit desk, same law
      }
    }
    if (!mute) scheduleBar(bar, sec, cur.chan, cur.kit, nextBarTime, sd, playSynth);
    nextBarTime += bar.barSteps * sd;
    nextBar = (nextBar + 1) % TL.length;
    if (nextBar === 0) loopStart = nextBarTime;   // the wrap will SOUND at this time
  }
  // PREBUILD ONE BAR AHEAD, outside the loop: the next bar to schedule may
  // open a section whose channel does not exist yet, and building an insert
  // chain plus a convolver return at the instant the section starts is
  // ZERO-STATIC glitch cause R2 (measured there: a 6-modules-in-46 ms burst
  // WAS the click). channelFor is cached by spec, so this is a no-op all the
  // times the channel already exists.
  if (!mute && TL.length) {
    const nb = TL[nextBar];
    if (nb && SONG[nb.si]) channelFor(SONG[nb.si], nextBarTime);
  }
}
// ONE BAR OF EVENTS ONTO A CHANNEL, at `when`, on whatever context the channel
// lives on. Extracted from tick() so the offline bounce schedules through the
// SAME switch — a forked copy is how the carrier would drift from the live
// sound one edit at a time. `synthFn` is the only context-bound player (the
// Faust pool belongs to the live context), so it is the one injectable: tick
// passes playSynth, the bounce passes its offline pool's player (or a
// return-false, which degrades a synth voice to its sampled instrument below).
export function scheduleBar(bar, sec, chan, kit, when, sd, synthFn) {
  for (const e of bar.ev) {
    const at = when + e.off * sd;
    if (e.kind === "line") {
      const owner = e.layer || gid(sec);
      // A SYNTH FONT OVERRIDES THE GENRE. Pure FM and Pure Analog are not a
      // sample set, they are "play everything on this voice" — including the
      // genres that carry a signature synth of their own.
      // ...AND THE SONG'S POOL PICK OVERRIDES THE SYNTH (but never the synth
      // font — that is a session law). Casting a rhodes in the chair acid's
      // line sits in means "play this on a rhodes", and a 303 wearing a
      // rhodes label would be the desk lying about the thing you just chose.
      // (The per-layer `instr` override this law was written for is gone —
      // the band is hired for the RECORD, one pool per song.)
      const over = poolInstrOf(sec, owner, e.lv == null ? e.v : e.lv, POOL);
      const gsyn = isSynthFont() ? fontDef().synth
        : (over ? null : GENRES[owner].synth);
      const id = over || instrOf(owner, e.lv == null ? e.v : e.lv);
      const useSyn = gsyn && !(gsyn.lineOnly && e.pad && !isSynthFont());
      if (useSyn && synthFn(gsyn, e.n, at, e.dur * sd, e.acc, e.sld, e.vel, e.v, chan, e.vox)) { /* signature voice */ }
      // a DEAD signature synth drops its notes rather than beeping: a
      // synth-identity genre has no legitimate second voice, and its sampled
      // `instr` was never fetched (ensureAssets skips it — the genre is
      // "never sampled"), so falling through here reached the oscillator —
      // measured: ten fallback beeps in one sweep when two wasm fetches
      // flaked under IO load. Silence is the design; RMS gates catch it if
      // it ever stops being transient.
      else if (useSyn && synthFn === playSynth && synthDead(gsyn, e.v)) countDrop();
      // THE STRIP FOLLOWS THE INSTRUMENT, not just the role. Every non-pad
      // voice used to take the lead strip — 200 Hz high-pass and a 3 dB lift at
      // 3 kHz — whatever was in the chair, so motown's upright piano lost its
      // left hand and vaporwave's strings (mean MIDI 42, fundamental 185 Hz)
      // lost their fundamental to the filter. instruments.js stripFor picks by
      // family; `pad` still wins outright, because a pad is a pad whoever plays
      // it. `home` is the register home this section decided for the chair.
      else if (!playSampled(id, e.n + (e.home || 0), at, e.dur * sd, e.vel, 1, chan,
                            stripFor(id, e.pad), e.v)) {
        // BOTH voices gone. For a plain sampled genre the oscillator stub is
        // the ancient last resort (and the gate proves it never fires); for a
        // SYNTH-identity genre it is the wrongest sound the page can make —
        // an oscillator standing in for a 303 — and that is exactly what
        // beeped ten times in one sweep when a wasm fetch and the zone fetch
        // both flaked under IO load. Identity genres drop instead.
        if (useSyn) countDrop();
        // the stub lands on the same chair's strip as the note it stands in
        // for — a fallback that jumps the desk would be audible under a solo —
        // and it plays the HOMED note: a register-shifted voice that fell back
        // must not jump an octave from the line it stands in for
        else line(at, e.n + (e.home || 0), e.dur * sd, e.acc, e.sld, e.prev,
                  bar.g.tone, e.pad, e.vel, chan, e.v);
      }
    } else if (e.kind === "hit") {
      if (!playDrum(kit, e.d, at, e.acc, e.vel, chan)) hit(at, e.d, e.acc, e.vel, chan);
    }
    else if (e.kind === "bass") {
      const bs = BASSSYNTH[sec.bassop];
      // THE BASS IS A PART, not a chair on the roster: it is one line per box
      // rather than one per genre voice, so it has no voice index and names
      // its strip instead. (The synth bass finds the same strip from its dsp
      // — mixer.synthIn.) It IS a pool seat, though: `pool.bass` recasts the
      // sampled bass song-wide. A set bassop synth still wins — a reese IS
      // its LFO (instruments.js's own law), and silently unplugging a lit
      // bassop chip would make it the one control on the page that lies.
      // THE STRIP FOLLOWS THE INSTRUMENT here too: the bass strip is written
      // for the acoustic bass, and a rhodes cast into the bass chair takes
      // its family strip, exactly as it would in any other chair.
      const bid = (POOL && POOL.bass) || BASS_INSTR;
      if (bs && synthFn(bs, e.n, at, e.dur * sd, 0, 0, e.vel, 0, chan, e.vox)) { /* synth bass */ }
      else if (!playSampled(bid, e.n, at, e.dur * sd, e.vel, 1.25, chan,
                            bid === BASS_INSTR ? STRIPS.bass : stripFor(bid, false),
                            null, "bass"))
        line(at, e.n, e.dur * sd, 1, 0, null,
          { wave: "square", cut: 340, q: 5, atk: .006, rel: .8, gain: .26 }, false, e.vel,
          chan, "bass");
    }
    // THE SINGER. No fallback of any kind: a syllable with nothing warmed for
    // it is SILENT, which is the same law the page already keeps for a dead
    // signature synth and an in-flight zone — silence over wrongness. A wrong
    // syllable is not a near miss, it is a different word.
    else if (e.kind === "sing")
      playSyllable(e, e.text, at, e.dur * sd, chan, e.colour, bar.barSteps * sd);
  }
}

/* ---------- what this song sings ---------- */
// EVERY UTTERANCE THE SONG NEEDS, deduped by (line text). Exported because
// audio/bounce.js needs the identical answer before it renders windows — the
// carrier is the audible path on mobile, so a voice warmed only for the live
// graph is a voice that does not exist on a phone. One walk, two callers, no
// second opinion about what is being sung.
export function singWork() {
  if (singOff()) return [];
  const byText = new Map();
  for (const sec of SONG) {
    if (!sec || !sec.sing) continue;
    for (const e of sectionRender(sec, SLOTS, GROOVE, SWING).ev) {
      if (e.kind !== "sing") continue;
      let w = byText.get(e.text);
      if (!w) byText.set(e.text, w = { text: e.text, plan: [] });
      w.plan.push(e);
    }
  }
  return [...byText.values()];
}

/* ---------- assets for the current song ---------- */
// Everything the CURRENT song needs that is not already decoded. Called before
// the transport starts AND on every song change while it is running — a genre
// switched mid-play needs its guitar and its kit exactly as much as one chosen
// before pressing play, and only the first case used to fetch them.
import { loadInstrument, loadKit } from "./assets.js";
export async function ensureAssets(announce) {
  await loadFont(FONT);
  // NOTHING DECODES WITHOUT AN AudioContext, and every loader caches its
  // failures so a dead zone is not re-fetched every bar. Called before the
  // transport has ever run — switching font or genre on a fresh page — that
  // cache would poison every instrument permanently. Bail before touching them.
  if (!ctx) return false;
  const need = instrumentsInSong().filter(id => {
    const sp = specOf(id); return sp && sp.zones.some(z => !zoneBufs.has(FONT + "|" + id + "|" + z.file));
  });
  const kits = [...new Set(SONG.map(x => kitOf(x)).filter(Boolean))]
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
  // THE SINGER WARMS HERE, beside the zone fetches, because it is the same
  // kind of thing: ~2 s of wasm work that the audio clock cannot wait for.
  // scheduleBar is a synchronous walk on the WebAudio clock and the offline
  // render is a synchronous walk with no clock at all, so an espeak instance
  // (~210 ms, one per voice per pitch rung) can only ever happen before the
  // first note is due. A song with no `sing` chip anywhere returns an empty
  // list here and nothing is fetched — the 1.7 MB artifact included.
  const sings = singWork().filter(w => needsWarm(w.plan, w.text));
  if (!need.length && !wantSynth.length && !kits.length && !sings.length) return false;
  if (announce) emit("status", { text:
    "loading " + [...need, ...new Set(wantSynth.map(x => x[0].dsp)), ...kits,
                  ...(sings.length ? ["voices"] : [])].join(", ") + "…" });
  const t0 = performance.now();
  // synths and kits in parallel (the decode gate caps the kit decodes anyway),
  // but instruments one at a time with a breath between WHILE PLAYING — the
  // precache rule from the big app: the live scheduler owns this thread, and a
  // decode burst with no yield starves it for whole bars
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const rest = Promise.all([...wantSynth.map(([sp, v, c]) => loadSynth(sp, v, c)),
                            ...kits.map(loadKit),
                            ...sings.map(w => warmSing(w.plan, w.text))]);
  for (const id of need) {
    await loadInstrument(id);
    if (playing) await nap(60);
  }
  await rest;
  if (announce) emit("status", { text:
    "loaded in " + Math.round(performance.now() - t0) + " ms" });
  return true;
}

/* ---------- transport ---------- */
export async function startAt(boxIndex) {
  // everything up to the first await runs INSIDE the user's gesture — initAudio
  // and the gesture hooks (the carrier element unlock) depend on that
  initAudio();
  // unconditional, never gated on ctx.state: iOS reports the non-standard
  // "interrupted" after an app switch, and gating on "suspended" alone never
  // resumes from it (the parent's live.js law)
  try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  for (const fn of gestureFns) { try { fn(); } catch (e) {} }
  // undo stop()'s mute-at-source (and clear the duck flag so the volume
  // slider works again); idempotent with the survival mute — goHidden after
  // a hidden start simply re-mutes
  unmuteRamp(20);
  BOOT.playPressed = Math.round(performance.now());
  compile();
  BOOT.assetsStart = Math.round(performance.now());
  if (await ensureAssets(true)) emit("refresh");
  BOOT.assetsDone = Math.round(performance.now());
  if (!TL.length) {
    emit("status", { text: "nothing to play — click a genre to fill a box first",
                     sticky: true });
    return;
  }
  // the FIRST section's channel (and its reverb) built here, before the clock
  // runs — never inside the render window at the first bar boundary
  const at = TL.findIndex(b => b.si === boxIndex && b.first);
  const first = TL[at < 0 ? 0 : at];
  if (first && SONG[first.si]) channelFor(SONG[first.si]);
  playing = true; playingSec = -1;
  nextBar = at < 0 ? 0 : at;
  nextBarTime = ctx.currentTime + .08; passStart = nextBarTime;
  loopStart = nextBarTime;
  BOOT.firstBar = Math.round(performance.now());
  startClock();
  watchFirstSound();
  emit("transport:state", { playing });
}
export function stop() {
  playing = false; stopClock(); playingSec = -1; setPendingStart(null);
  // silence the graph NOW: every voice is fire-and-forget, scheduled up to
  // 2 s ahead when hidden, and nothing else cancels them — a media-key pause
  // on a hidden tab otherwise reports "paused" over two more seconds of
  // music. startAt's unmuteRamp restores the master gain on the next play.
  muteNow();
  emit("transport:state", { playing });
}
// JUMP THE TRANSPORT to a phase (seconds into the song) — the return half of
// the carrier handoff: the ear followed the looping element while the graph's
// clock was frozen, so on return the graph must pick up where the ELEMENT is,
// not where the freeze left it. Lands on the next bar boundary at or after the
// phase, because events are scheduled per bar.
export function seekPhase(phaseSec) {
  if (!playing || !TL.length || !ctx) return;
  const sd = stepDur(), dur = songDurSec();
  if (!(dur > 0)) return;
  const p = ((phaseSec % dur) + dur) % dur;
  let acc = 0, i = 0;
  for (; i < TL.length; i++) { const d = TL[i].barSteps * sd; if (acc + d > p) break; acc += d; }
  if (i >= TL.length) i = TL.length - 1;
  const wait = Math.max(0.03, (acc + TL[i].barSteps * sd) - p);   // rest of the bar the ear is in
  nextBar = (i + 1) % TL.length;
  nextBarTime = ctx.currentTime + wait;
  passStart = nextBarTime;
  // where THIS pass began, back-computed so positionState stays honest
  let upto = 0; for (let b = 0; b < nextBar; b++) upto += TL[b].barSteps * sd;
  loopStart = nextBarTime - upto;
}
// what the playhead animation is allowed to know — the three UI-from-audio
// reads (ctx.currentTime, passStart, playingSec) behind one accessor.
// loopStart/durSec are the song-position half, for MediaSession and the
// carrier's phase lock.
export const getPosition = () => ({
  playing, si: playingSec,
  passStart, now: ctx ? ctx.currentTime : 0, stepDur: stepDur(),
  loopStart, durSec: songDurSec(),
});

/* ---------- subscriptions ---------- */
// the "something changed" law, in one place: a musical change while playing
// recompiles the bar list and fetches whatever the change needs
const changed = () => {
  if (!playing) return;
  compile();
  ensureAssets(false).then(ok => { if (ok) emit("refresh"); });
};
on("phrase", changed);
on("box", changed);
// the song's groove moved: every event time downstream of it moved, so the
// bar list must be rebuilt — a "transport" (bpm) change never needs this,
// because stepDur is read per tick, but the groove is baked into the events
on("groove", changed);
on("swing", changed);                      // ...and the swing is baked the same way
// the band changed: the register homes are decided per instrument, so the bar
// list carries the pool's consequences — and the recast chair's zones fetch
on("pool", changed);
on("song", () => { if (playing) stop(); });
