// nukernel/embed/page.js — nukernel/embed.html's whole script: the radio, as a
// host would use it. `?log` in the address keeps the radio's own lines on the
// page (a start, a swap, a round, the watchdog) and starts the heartbeat
// (./heartbeat.js: what the phone did to the page while it was away), for a
// phone with no console. `&to=<a path on this site>` also POSTs the lines there
// as `{ lines }` every few seconds and when the page is shown again, with
// `&hdr=<name>` set to 1 if the host's log asks for a header of its own.
import { load } from "./index.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const lines = [], unsent = [], wantLog = Q.has("log"), to = Q.get("to"), hdr = Q.get("hdr");
const t0 = Date.now();
const say = (s) => {
  if (!wantLog) return;
  const line = ((Date.now() - t0) / 1000).toFixed(1) + " " + s;
  lines.push(line); unsent.push(line);
  $("log").textContent = lines.slice(-60).join("\n");
};
function send(last) {
  if (!to || !to.startsWith("/") || to.startsWith("//") || !unsent.length) return;
  const batch = unsent.splice(0, 60), headers = { "content-type": "application/json" };
  if (hdr && /^[a-z-]+$/i.test(hdr)) headers[hdr] = "1";
  fetch(to, { method: "POST", credentials: "same-origin", keepalive: !!last, headers, body: JSON.stringify({ lines: batch }) }).catch(() => {});
}
if (wantLog && to) {
  setInterval(() => send(false), 5000);
  // the report is written a moment after the page is shown: send it then
  document.addEventListener("visibilitychange", () => { if (document.hidden) send(true); else setTimeout(() => send(false), 2500); });
}
let radio = null, on = false;
const shown = () => { $("play").textContent = on ? "Pause" : "Play"; $("play").setAttribute("aria-pressed", String(on)); };
const opts = { log: say, went: (now) => { on = now; shown(); } };

// fetched at idle, so the touch finds it loaded
const warm = () => load(opts).then((r) => { radio = r; }).catch((e) => say("load failed: " + e.message));
(window.requestIdleCallback || ((f) => setTimeout(f, 800)))(warm);
if (wantLog) import("./heartbeat.js").then((h) => h.startHeartbeat(say, () => (radio ? radio.now().engine : null))).catch((e) => say("heartbeat failed: " + e.message));

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
