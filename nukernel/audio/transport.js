// audio/transport.js — the scheduler and the clock: compile the song into a
// bar list, tick along it on the audio clock, start and stop. The TOP of the
// audio tier — it drives graph/assets/voices/mixer and reads state/derive,
// and it NEVER imports a ui view. Where the old tick() reached into the UI
// (showSection -> drawSong), it now PUBLISHES — "transport:state" when playing
// flips, "transport:section" when the sounding box moves, "status" for the
// readout line, "refresh" when assets land mid-play — and the views subscribe.
// The playhead animation reads getPosition() instead of the internals.
import { GENRES, DTIMES, BASSSYNTH, BASS_INSTR, STRIPS, instrOf } from "../ui/deps.js";
import { SONG, loopOnly, pendingStart, setPendingStart, bpm, on, emit,
         SLOTS } from "../ui/state.js";
import { gid, stackOf, boxBars, kitOf, sectionRender } from "../ui/derive.js";
import { ctx, initAudio } from "./graph.js";
import { FONT, fontDef, isSynthFont, loadFont, specOf, zoneBufs, drumBufs,
         instrumentsInSong } from "./assets.js";
import { synthNodes, synthKey, loadSynth, focusSynths, playSynth, playSampled,
         playDrum, line, hit } from "./voices.js";
import { channelFor, armMotion } from "./mixer.js";
import { setDelayTime } from "./graph.js";

export let playing = false;
export let playingSec = -1;
let timer = null, nextBarTime = 0, nextBar = 0, passStart = 0;

/* ---------- scheduler ---------- */
let TL = [];
export function compile() {
  TL = [];
  const list = loopOnly == null ? SONG.map((s, i) => [s, i]) : [[SONG[loopOnly], loopOnly]];
  for (const [sec, si] of list) {
    const { g, bars, ev } = sectionRender(sec, SLOTS);
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
    for (const e of ev) {
      const b = Math.min(bars - 1, Math.floor(e.t / barSteps));
      buckets[b].push({ ...e, off: e.t - b * barSteps });
    }
    for (let b = 0; b < bars; b++)
      TL.push({ si, g, barSteps, first: b === 0, ev: buckets[b] });
  }
}
export const stepDur = () => 60 / bpm / 4;
export function resetBar() { nextBar = 0; }

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
    if (!cur || cur.si !== bar.si || bar.first) cur = { si: bar.si, chan: channelFor(sec), kit: kitOf(sec) };
    const chan = cur.chan;
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
        if (!playDrum(cur.kit, e.d, when, e.acc, e.vel, chan)) hit(when, e.d, e.acc, e.vel, chan);
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
  if (!need.length && !wantSynth.length && !kits.length) return false;
  if (announce) emit("status", { text:
    "loading " + [...need, ...new Set(wantSynth.map(x => x[0].dsp)), ...kits].join(", ") + "…" });
  await Promise.all([...need.map(loadInstrument),
                     ...wantSynth.map(([sp, v, c]) => loadSynth(sp, v, c)),
                     ...kits.map(loadKit)]);
  return true;
}

/* ---------- transport ---------- */
export async function startAt(boxIndex) {
  initAudio(); if (ctx.state === "suspended") ctx.resume();
  compile();
  if (await ensureAssets(true)) emit("refresh");
  if (!TL.length) {
    emit("status", { text: "nothing to play — click a genre to fill a box first",
                     sticky: true });
    return;
  }
  const at = TL.findIndex(b => b.si === boxIndex && b.first);
  playing = true; playingSec = -1;
  nextBar = at < 0 ? 0 : at;
  nextBarTime = ctx.currentTime + .08; passStart = nextBarTime;
  startClock();
  emit("transport:state", { playing });
}
export function stop() {
  playing = false; stopClock(); playingSec = -1; setPendingStart(null);
  emit("transport:state", { playing });
}
// what the playhead animation is allowed to know — the three UI-from-audio
// reads (ctx.currentTime, passStart, playingSec) behind one accessor
export const getPosition = () => ({
  playing, si: playingSec,
  passStart, now: ctx ? ctx.currentTime : 0, stepDur: stepDur(),
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
on("song", () => { if (playing) stop(); });
