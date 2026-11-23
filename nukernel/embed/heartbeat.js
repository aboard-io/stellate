// nukernel/embed/heartbeat.js — WHAT A PHONE DID TO THE PAGE WHILE IT WAS AWAY
// (2026-11-23).
//
// Paul, iOS 27.01, Safari, a tab, switching apps: *"I can lose focus on the app
// but after a half minute it seems to stop … Then it sometimes starts again
// sometimes not."* Nothing in this box changed between the day that worked and
// the day it did not, so the question is what the phone now does to a hidden
// page — and a hidden page cannot be watched from a console. This watches from
// inside, with three clocks that can each be stopped separately:
//
//   the PAGE's own timer      a 250 ms interval; a gap is the main thread held
//   a WORKER's timer          the same, on its own thread (the render and the
//                             encode are workers: if these stop, nothing new
//                             is made, whatever the page does)
//   the AUDIO ELEMENT's time  whether sound was still coming out, and how much
//                             was buffered ahead of it
//
// and the page being hidden and shown, by the wall clock. When the page is
// shown again it says, in a few lines, how long it was away, when each clock
// stopped and for how long, and when the element ran out. That is the
// difference between "the phone stopped our scripts and the buffer drained"
// (make the buffer long before hiding) and "the phone paused the element"
// (nothing a buffer can do).
//
// It costs a worker and a timer, so it runs only when the page asks
// (nukernel/embed.html?log).
const GAP = 1000;
const hhmmss = (t) => new Date(t).toTimeString().slice(0, 8);
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

/** say(line): where lines go. engine(): the radio's `now().engine`, or null. */
export function startHeartbeat(say, engine) {
  const t0 = Date.now();
  let last = t0, hiddenAt = 0, atHide = null;
  const gaps = [], events = [];
  const el = () => [...document.querySelectorAll("audio")].find((a) => (a.src || "").startsWith("blob:") || a.srcObject) || null;
  const ahead = (e) => {
    try {
      for (let i = 0; i < e.buffered.length; i++)
        if (e.buffered.start(i) <= e.currentTime + 0.25 && e.buffered.end(i) >= e.currentTime) return e.buffered.end(i) - e.currentTime;
    } catch (x) {}
    return 0;
  };
  const snap = () => {
    const e = el(), g = (() => { try { return engine() || {}; } catch (x) { return {}; } })();
    return { t: Date.now(), time: e ? e.currentTime : null, paused: e ? e.paused : null, rs: e ? e.readyState : null,
             ahead: e ? ahead(e) : null, runway: typeof g.runway === "number" ? g.runway : null, route: g.route || "",
             // the append pump's own ledger (engine/faust/live/live.js __wavState): what was appended, what waits,
             // whether the managed source is asking, and how often it was fed without asking
             wav: g.wav ? { app: g.wav.appendedSec, q: g.wav.appendQ, wants: g.wav.mmsWants, streaming: g.wav.mmsStreaming, starve: g.wav.mmsStarveAppends } : null };
  };
  const fmt = (s) => "el " + (s.time == null ? "none" : (s.paused ? "paused" : "playing") + " t=" + s.time.toFixed(1) + " rs=" + s.rs + " ahead=" + s.ahead.toFixed(1))
    + (s.runway == null ? "" : " runway=" + s.runway.toFixed(1)) + (s.route ? " " + s.route : "")
    + (s.wav ? " appended=" + s.wav.app + " queued=" + s.wav.q + " wants=" + s.wav.wants + " streaming=" + s.wav.streaming + " fedUnasked=" + s.wav.starve : "");

  let worker = null;
  try { worker = new Worker(new URL("./heartbeat-worker.js", import.meta.url)); } catch (x) { say("heartbeat: no worker (" + x.message + ")"); }

  const watched = new WeakSet();
  const watch = () => {
    const e = el();
    if (!e || watched.has(e)) return;
    watched.add(e);
    for (const n of ["waiting", "stalled", "pause", "playing", "ended", "error", "suspend", "emptied"])
      e.addEventListener(n, () => { events.push({ t: Date.now(), n, time: e.currentTime, ahead: ahead(e) }); if (events.length > 300) events.shift(); });
  };

  let lastSample = null, ranDryAt = 0;
  setInterval(() => {
    const now = Date.now();
    if (now - last > GAP) { gaps.push({ at: last, ms: now - last }); if (gaps.length > 200) gaps.shift(); }
    last = now;
    watch();
    // the element's clock, sampled: the first moment it stops advancing while hidden
    const s = snap();
    if (hiddenAt && !ranDryAt && lastSample && s.time != null && lastSample.time != null && s.time - lastSample.time < 0.02) ranDryAt = lastSample.t;
    lastSample = s;
  }, 250);
  // a line every five seconds, shown or hidden (a hidden page's timers still run, slowly)
  setInterval(() => { say((document.hidden ? "beat(hidden) " : "beat ") + fmt(snap())); }, 5000);

  const within = (list, a, b) => list.filter((g) => g.at + g.ms > a && g.at < b);
  const tell = (name, list, a) => list.length
    ? name + ": stopped " + list.length + "× — " + list.slice(0, 6).map((g) => "+" + secs(Math.max(0, g.at - a)) + " for " + secs(g.ms)).join(", ") + (list.length > 6 ? " …" : "")
    : name + ": never stopped";

  function shown() {
    if (!hiddenAt) return;
    const a = hiddenAt, b = Date.now(), before = atHide, after = snap();
    hiddenAt = 0;
    const report = (wgaps) => {
      say("AWAY " + secs(b - a) + " (" + hhmmss(a) + " → " + hhmmss(b) + ")");
      say("  at hide: " + (before ? fmt(before) : "?"));
      say("  at show: " + fmt(after));
      if (before && before.time != null && after.time != null)
        say("  sound: the element's clock moved " + (after.time - before.time).toFixed(1) + "s of " + secs(b - a)
          + (ranDryAt ? "; it stopped moving at +" + secs(ranDryAt - a) : ""));
      say("  " + tell("page timer", within(gaps, a, b), a));
      say("  " + (wgaps ? tell("worker timer", within(wgaps, a, b), a) : "worker timer: no answer"));
      const ev = events.filter((e) => e.t >= a - 500 && e.t <= b + 500);
      say("  element events: " + (ev.length ? ev.slice(0, 12).map((e) => e.n + " +" + secs(Math.max(0, e.t - a)) + " ahead=" + e.ahead.toFixed(1)).join(", ") : "none"));
      ranDryAt = 0;
    };
    if (!worker) return report(null);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; report(null); } }, 1500);
    worker.onmessage = (m) => { if (done) return; done = true; clearTimeout(timer); report(m.data.gaps || []); };
    worker.postMessage("gaps");
  }
  const hide = (why) => { if (hiddenAt) return; hiddenAt = Date.now(); atHide = snap(); ranDryAt = 0; say(why + " " + fmt(atHide)); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) hide("hidden"); else { say("visible"); shown(); } });
  addEventListener("pagehide", () => hide("pagehide"));
  addEventListener("pageshow", (e) => { say("pageshow" + (e.persisted ? " (from the back/forward cache)" : "")); shown(); });
  document.addEventListener("freeze", () => say("freeze"));
  document.addEventListener("resume", () => say("resume"));
  say("heartbeat " + navigator.userAgent);
}
