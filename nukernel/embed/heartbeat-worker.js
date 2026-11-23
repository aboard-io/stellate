// nukernel/embed/heartbeat-worker.js — a worker that only notes when it was
// not allowed to run (./heartbeat.js). It ticks four times a second and keeps
// every gap over a second, by the wall clock; asked, it says them.
let last = Date.now();
const gaps = [];
setInterval(() => {
  const now = Date.now();
  if (now - last > 1000) { gaps.push({ at: last, ms: now - last }); if (gaps.length > 200) gaps.shift(); }
  last = now;
}, 250);
onmessage = () => postMessage({ gaps: gaps.slice(), now: Date.now() });
