// clock.js — the scheduler's heartbeat, in a worker.
//
// THE PROBLEM IS THE BACKGROUND TAB. The bar scheduler runs on a timer and looks
// ahead 150 ms: every tick it fills the audio clock up to now+150ms and goes back
// to sleep. That is the standard WebAudio arrangement and it has one failure
// mode, which is that browsers clamp `setInterval` in a hidden tab to roughly
// once a SECOND. A once-a-second timer filling a 150 ms queue starves it seven
// times out of eight, and what you hear is the music falling apart the moment you
// change tabs — not a bug in the audio, a bug in who is asking for it.
//
// A dedicated worker's timers are not clamped the same way, so the tick keeps
// arriving at its real rate with the tab hidden. This is the same reason the big
// engine drives its ring from a worker (engine/faust/live/stream-worker.js) and
// the lesson is recorded in docs/history/ZERO-STATIC.md: never let the main
// thread's scheduling be the thing the audio depends on.
//
// It is a FILE and not a blob on purpose — the production CSP is `worker-src
// 'self'`, so a blob worker is blocked in production and works everywhere else,
// which is the worst way for a thing to fail.
//
// The page still keeps its own setInterval as a fallback and widens its lookahead
// when hidden, because belt and braces cost nothing here and a worker that fails
// to construct must not take the transport with it.
"use strict";
let timer = null;
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.cmd === "start") {
    clearInterval(timer);
    timer = setInterval(() => self.postMessage("tick"), Math.max(5, m.ms || 25));
  } else if (m.cmd === "stop") {
    clearInterval(timer); timer = null;
  }
};
