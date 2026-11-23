// nukernel/embed/radio.js — THE ALBUM THAT NEVER STOPS THE ENGINE (2026-11-23).
//
// Paul: *"Maybe the right path is to stop and create a branch of stellate that
// can just be embedded … We did this in stellate and it took forever to get
// right."* A page that embedded the box by hand (Unscroll Journey's Clock)
// played an album the way a turntable does — fade, `stop()`, a new record,
// `startAt(0)` — and on an iPhone the music died at the first change of
// record. It had to: a phone lets a page start sound only inside a touch, the
// engine's one <audio> element is born in that touch (audio/live.js THE
// IN-GESTURE UNLOCK), and a second start a few minutes later has no touch.
//
// THE BOX ALREADY HAD THE OTHER DOOR. ui/eight.js `evolve` (2026-09-03, *"Instead
// of stopping the music compose the new song then show a countdown until the
// new version plays"*) replaces the record under a running transport: `push`
// WITHOUT `adoptSong` — adopting a song emits "song", and audio/live.js answers
// "song" with `stop()` — and the walk reads the new plan on the next bar it
// asks for. So this radio starts the engine ONCE, in the touch, and every
// record after the first goes in under it (./stellate.js `put(doc, true)`,
// then `start()`, which while playing only queues a jump to the first box on
// the next bar line). The stream to the element — rendered ahead, encoded,
// appended — is never broken. MEASURED, Chromium as an iPhone, five minutes
// across a natural change of record: one element, its clock never reset, the
// buffer ahead never under 4 s.
//
// AND THE TRANSPORT IS THE ENGINE'S, NOT THIS FILE'S. The lock screen's pause
// and play are audio/live.js's mediaSession handlers, and the engine can give
// up by itself; `transport:state` says either. The radio follows: stopped by
// the engine, it is off and says so (`went(false)`), and the host's next touch
// starts it — nothing here restarts an engine outside a touch except the one
// watchdog below, which is for a transport that says it is playing and has
// sent no position for WATCH_MS while the page is shown.
//
// THE DIP. The sound drops to DIP of its level before a record goes in, and
// rises when the new record's first bar is HEARD (`pos` at bar 0, at a serial
// after the hand-over) — not when it is asked for, which is a runway earlier.
// It is never silence: on a phone the level is baked into the render, so a
// fade to nothing would be heard a runway late and swallow the new record's
// opening.
//
// THIS FILE TOUCHES NO ENGINE. It is given `S` (./stellate.js in a page, a
// fake in test/embed.test.js) and a clock, so every sentence above is asserted
// on a fake clock in a few milliseconds.
import { partOf, planAt, slowRecord } from "./slow.js";

export const PASSES = 2, FADE_MS = 2000, PAUSE_MS = 1000, WATCH_MS = 8000,
  WARM_MS = 8000, HEAR_MS = 6000, STEPS = 50, DIP = 0.3, DIP_MS = 3000,
  RISE_MS = 4000, LAND_MS = 20000;
/** How loud the engine is asked to play for a volume 0..1: v^1.5, so the lower
 *  half of a slider is usable. */
export const gainOf = (v) => Math.max(0, Math.min(1, v)) ** 1.5;

const realClock = { now: () => Date.now(), after: (ms, fn) => { setTimeout(fn, ms); } };

/** o: { S, clock?, seed?, part?(), choose?(n, prev, part), shape?(doc, plan),
 *       hidden?(), beat?(pos), went?(on), log?(line) } */
export function makeRadio(o) {
  const S = o.S, clock = o.clock || realClock, log = o.log || (() => {});
  const part = o.part || (() => partOf(new Date(clock.now()).getHours()));
  const shape = o.shape || slowRecord;
  let seed = o.seed || 1;
  const choose = o.choose || ((n, prev, p) => planAt(seed, n, p, prev));
  let wired = false, live = false, busy = false, sounding = false, pausing = false;
  let vol = 0.5, k = 0, n = 0, prev, rounds = 0, lastPos = 0, genre = "", bpm = 0;
  // each play and each pause is a new `turn`: what an older turn still waits
  // for, it then leaves alone
  let turn = 0, watching = false, heard = null, landing = -1, ser = 0, mine = false;

  const wait = (ms) => new Promise((ok) => clock.after(ms, ok));
  const within = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), wait(ms)]);
  const level = (x) => { k = x; S.volume(gainOf(vol) * k); };
  async function fade(to, t, ms = FADE_MS) {
    const from = k;
    for (let i = 1; i <= STEPS; i++) {
      await wait(ms / STEPS);
      if (t !== turn) return false;
      level(from + ((to - from) * i) / STEPS);
    }
    return true;
  }
  const stop = () => { sounding = false; mine = true; S.stop(); mine = false; log("stop " + genre); };
  const route = () => { try { return String(S.report().route || ""); } catch (e) { return ""; } };

  // The next record. The first is started (in the touch); each after it goes in
  // under the engine; `hard` is the watchdog's stop-and-start.
  async function next(first, hard) {
    if (busy) return;
    busy = true; const t = turn;
    try {
      const plan = choose(n++, prev, part());
      const doc = shape(S.record(plan.genre, plan.seed), plan);
      const swap = !first && !hard && sounding;
      await within(S.warm(doc), WARM_MS);
      if (t !== turn) return;
      if (!first && !(await fade(swap ? DIP : 0, t, swap ? DIP_MS : FADE_MS))) return;
      if (!first && !swap) stop();
      prev = genre = plan.genre; bpm = doc.time.bpm; rounds = 0; landing = swap ? ser : -1;
      S.put(doc, swap); if (!swap) level(0);
      await S.start();
      if (t !== turn) return;
      sounding = true; lastPos = clock.now();
      log((swap ? "swap " : "start ") + genre + " bpm=" + bpm + " route=" + route());
      await within(new Promise((ok) => { heard = ok; }), swap ? LAND_MS : HEAR_MS);
      heard = null; landing = -1;
      if (t === turn) await fade(1, t, swap ? RISE_MS : FADE_MS);
    } finally { if (t === turn) busy = false; }
  }
  function watch() {
    if (!live) { watching = false; return; }
    // a hidden page hears no positions and may start no sound: wait to be shown
    if (o.hidden && o.hidden()) lastPos = clock.now();
    if (!busy && clock.now() - lastPos > WATCH_MS) {
      log("watchdog " + genre + " route=" + route());
      next(false, true);
    }
    clock.after(1000, watch);
  }
  const watched = () => {
    lastPos = clock.now();
    if (!watching) { watching = true; clock.after(1000, watch); }
  };
  function wire() {
    if (wired) return;
    wired = true;
    S.on("pos", (p) => {
      lastPos = clock.now();
      if (p.serial != null) ser = p.serial;
      if (landing < 0 || (p.bar === 0 && p.si === 0 && ser > landing)) { if (heard) heard(); }
      if (o.beat) o.beat(p);
    });
    S.on("transport:round", () => {
      log("round " + genre + " " + (rounds + 1));
      if (live && ++rounds >= PASSES) next(false, false);
    });
    S.on("transport:state", (d) => {
      if (mine || d.playing === live) return;
      log("stellate " + (d.playing ? "started" : "stopped") + " itself");
      live = sounding = d.playing; pausing = false; ++turn; busy = false;
      if (d.playing) { level(1); watched(); }
      if (o.went) o.went(d.playing);
    });
  }
  return {
    /** Plays, from a touch. Resolves when the first record has faded in. */
    async play(volume) {
      if (volume != null) vol = volume;
      if (S.touch) S.touch();
      if (live) { level(k); return; }
      live = true; busy = false; const t = ++turn;
      wire();
      if (pausing) { pausing = false; watched(); await fade(1, t); return; }
      watched();
      await next(true, false);
    },
    /** Fades out, then stops (a play within the fade brings the record back). */
    pause() {
      if (!live) return;
      live = false; busy = false; pausing = sounding; const t = ++turn;
      fade(0, t, PAUSE_MS).then((done) => { if (done) { pausing = false; stop(); } });
    },
    /** How loud, 0..1. */
    level(volume) { vol = volume; level(k); },
    playing: () => live,
    /** What is playing, and what the engine says of itself. */
    now: () => ({ genre, bpm, rounds, n, busy, lastPos, engine: S.report() }),
  };
}
