// nukernel/audio/offline.js — ONCE THE RECORD IS CALLED, IT IS YOURS.
//
// The pages in this box never registered the service worker, so every load
// went to the network and every sample was fetched again when it was first
// played — on a phone, in a room with no signal, that is a silent app.
//
// TWO THINGS, and neither of them is new machinery: `sw.js` at the root
// already caches the app stale-while-revalidate and everything under
// /found/ cache-first-forever (it is the explorer's own worker), and
// `audio/plan.js warmSources()` already knows exactly which samples the
// song's whole cast will ask for — that is the set the parent's stream
// routes are fed. So: register the worker, and when the record changes,
// fetch that set once so the worker files it. After that the record plays
// with the network off.
import { warmSources, unitTable, compile } from "./plan.js";

const SITE = new URL("../../", import.meta.url).href;   // the site root, from /nukernel/audio/
const done = new Set();                                 // asked for once, ever
let inflight = 0;

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try { navigator.serviceWorker.register(new URL("sw.js", SITE).href).catch(() => {}); }
  catch (e) { /* file:// or a browser that will not have it */ }
}

// EVERY SAMPLE THE CAST CAN ASK FOR, fetched once. Bounded on purpose: a
// phone on a metered connection should not download a crate because a genre
// was called, and the cast of one record is small (measured: a rock record
// is 30-odd files) — but the fence is here so a future record cannot become
// a flood without somebody moving this number.
const CAP = 120, PARALLEL = 6;
export function warmCache() {
  if (!("serviceWorker" in navigator)) return;
  // THE PLAN FIRST. The warm runs on a record change, and the unit table it
  // reads is whatever the LAST compile left — so a chair that just joined
  // (measured: the singer, eighteen ahh_choir zones) was warmed on the next
  // change instead of this one, which with the wire cut is never.
  try { compile(); } catch (e) {}
  const urls = [];
  const add = (p) => {
    if (!p || /^https?:/i.test(p)) return;               // cross-origin: the worker cannot cache it
    const href = new URL(p, SITE).href;
    if (done.has(href) || urls.length >= CAP) return;
    done.add(href); urls.push(href);
  };
  // (a) the CRATE — drums and found sound, which carry their own paths
  try { for (const s of ((warmSources() || {}).samplerSrcs || []))
    add(s && (s.samplePath || s.path || s.url)); } catch (e) {}
  // (b) the INSTRUMENTS — a sampled instrument's zones are named by the
  // registry, not by the crate, so the bass went to the network every time
  // (measured with the wire cut: eighteen failed requests, all of them
  // found/samples/instruments/acoustic_bass/). A unit says which sampler it
  // is; the registry says which files that sampler is made of.
  try {
    // the kernel is a classic global on these pages (`GenreKernel`), which
    // is the one place SAMPLERS lives — deps() is a promise and this runs on
    // a tap
    const SAMPLERS = ((window.GenreKernel || {}).SAMPLERS) || {};
    const ids = new Set();
    for (const u of Object.values(unitTable() || {}))
      if (u && u.sampler && u.sampler.id) ids.add(u.sampler.id);
    // ...and the BASS, which is not in the unit table at all: the kernel's
    // own bass line plays a sampler named once in instruments.js
    // (BASS_INSTR), and measured with the wire cut it was the only thing
    // still going to the network.
    const NI = window.NuInstruments || {};
    if (NI.BASS_INSTR) ids.add(NI.BASS_INSTR);
    for (const id of (NI.BASSSYNTH ? Object.keys(NI.BASSSYNTH) : [])) ids.add(id);
    for (const id of ids) {
      const sm = SAMPLERS[id];
      if (!sm || !sm.dir) continue;
      for (const z of (sm.zones || [])) add("found/samples/instruments/" + sm.dir + "/" + z.file);
    }
  } catch (e) {}
  const next = () => {
    const href = urls.shift();
    if (!href) { inflight--; return; }
    fetch(href, { cache: "force-cache" }).catch(() => {}).then(next);
  };
  for (let i = 0; i < PARALLEL && urls.length; i++) { inflight++; next(); }
}

// THE SHELL, warmed by asking the page what it loaded. The worker only
// caches what goes THROUGH it, and on a first visit it takes control after
// the page has already fetched itself — so the page's own HTML, styles,
// modules and engine files were never in the cache and an offline reload
// went to a dead network. `performance.getEntriesByType("resource")` is the
// exact list of what this page needed; fetching it once, through the worker,
// is what makes the second visit work with the wire cut. (No hand-written
// manifest: a list of files to keep in sync is a list that rots.)
export function warmShell() {
  if (!("serviceWorker" in navigator)) return;
  const go = () => {
    const here = location.origin;
    const urls = [location.href.split("#")[0]];
    try {
      for (const e of performance.getEntriesByType("resource"))
        if (e.name && e.name.startsWith(here)) urls.push(e.name.split("#")[0]);
    } catch (err) { /* no timing API: the page still works, it just reloads online */ }
    for (const u of urls) {
      if (done.has(u)) continue;
      done.add(u);
      fetch(u, { cache: "reload" }).catch(() => {});
    }
  };
  // ...once the worker is actually in charge of this page's fetches
  if (navigator.serviceWorker.controller) go();
  else navigator.serviceWorker.addEventListener("controllerchange", go, { once: true });
  if (navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(() => setTimeout(go, 200));
}

// what is warm, for a gate to ask
export const warmed = () => [...done];
