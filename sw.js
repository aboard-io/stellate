// sw.js — OFFLINE, WHERE POSSIBLE (Paul 2026-07-10: "we need it to work
// offline — where possible. For example precache samples for instruments
// along a route.")
//
// Two honest strategies, split by the repo's own immutability law:
//   CACHE-FIRST for /found/** and /engine/faust/dist/** — the deploy invariant
//     already enforces that these classes are IMMUTABLE (a media file or a
//     compiled wasm never changes in place; it is added or renamed). So a
//     cached copy is correct forever, and every sample the engine ever fetches
//     becomes part of the offline set just by playing — plus the route
//     precacher (app/precache.js) warms them ahead of the traveler.
//   NETWORK-FIRST (cache fallback) for every other same-origin GET — app code
//     and engine JS update on deploy, so the network wins when you're online,
//     and the last-seen version still boots the site when you're not.
// Cross-origin (esm.sh preact, archive.org beds) is left untouched: those
// requests carry their own CORS/CORP story and the crossOriginIsolated page
// needs their original headers verbatim.
//
// Cached Response objects keep their original headers, so COOP/COEP isolation
// (SharedArrayBuffer for the render worker) survives offline replay.
const VERSION = "stellate-v4";   // v4 (2026-07-11): +9 genres (intl+western); BUMP purges the old cache on activate so a deploy lands
                                 // in ONE load, not two (the v2 stale-while-revalidate served a load-behind copy —
                                 // Paul saw none of the synth-font/video/vapor batch until a second reload). Bump
                                 // this string every deploy that must reach users immediately.
                                 // (2026-07-10): app code goes STALE-WHILE-REVALIDATE — the origin serves
// cache-control:no-cache, so pre-SW every visit revalidated ~20 files serially (one RTT each — Paul: "it
// loads very slowly now" on a phone) and v1's network-first made that a hard wait. Now a repeat visit
// paints from cache INSTANTLY while a background fetch refreshes the copy for the NEXT load — a deploy
// lands one reload later, which the ship flow tolerates (hard-reload busts when it matters).
const IMMUTABLE = /^\/(found\/|engine\/faust\/dist\/)/;

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // same-origin only
  const path = url.pathname.replace(/^.*?(?=\/(found|engine|app|test|how|index|access)\b)/, "");   // tolerate a sub-path deploy
  if (IMMUTABLE.test(url.pathname) || IMMUTABLE.test(path)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
  } else {
    // STALE-WHILE-REVALIDATE: cached copy NOW, fresh copy in the background.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: url.pathname.endsWith(".html") || url.pathname === "/" });
      const refresh = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; });
      if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
      try { return await refresh; }
      catch (err) { throw err; }
    })());
  }
});
