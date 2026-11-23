// nukernel/embed/page.js — nukernel/embed.html's whole script: the radio, as a
// host would use it. `?log` in the address keeps the radio's own lines on the
// page (a start, a swap, a round, the watchdog), for a phone with no console.
import { load } from "./index.js";

const $ = (id) => document.getElementById(id);
const lines = [], wantLog = /[?&]log\b/.test(location.search);
const t0 = Date.now();
const say = (s) => {
  if (!wantLog) return;
  lines.push(((Date.now() - t0) / 1000).toFixed(1) + " " + s);
  $("log").textContent = lines.slice(-40).join("\n");
};
let radio = null, on = false;
const shown = () => { $("play").textContent = on ? "Pause" : "Play"; $("play").setAttribute("aria-pressed", String(on)); };
const opts = { log: say, went: (now) => { on = now; shown(); } };

// fetched at idle, so the touch finds it loaded
const warm = () => load(opts).then((r) => { radio = r; }).catch((e) => say("load failed: " + e.message));
(window.requestIdleCallback || ((f) => setTimeout(f, 800)))(warm);

$("play").addEventListener("click", async () => {
  if (on) { on = false; shown(); if (radio) radio.pause(); return; }
  on = true; shown();
  try {
    if (!radio) radio = await load(opts);
    await radio.play($("vol").value / 100);
  } catch (e) { on = false; shown(); say("play failed: " + e.message); }
});
$("vol").addEventListener("input", () => { if (radio) radio.level($("vol").value / 100); });
setInterval(() => {
  if (!radio) return;
  const n = radio.now();
  $("what").textContent = on && n.genre ? n.genre + " · " + n.bpm + " bpm · pass " + (n.rounds + 1) : "";
  // the route and the runway, not audio/live.js's whole sentence: on a host page
  // that is not cross-origin isolated the media route is the one ASKED for
  // (./index.js), and "the streaming engine could not start" would be untrue
  const e = n.engine || {};
  $("engine").textContent = on && e.route ? e.route + (typeof e.runway === "number" ? " · runway " + e.runway.toFixed(1) + "s" : "") : "";
}, 1000);
