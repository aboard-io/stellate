// sw.js — OFFLINE, WHERE POSSIBLE: the samples the engine fetches become the
// offline set just by playing, and the route precacher (app/audio/precache.js) warms
// them ahead of the traveler.
//
// TWO caches, because the two classes have different lifetimes:
//
//   MEDIA — /found/** only, NEVER version-bumped. Media is versioned-by-name (a
//     file is added or renamed, never edited in place) and the deploy serves it
//     with immutable headers, so a cached copy is correct forever. CACHE-FIRST,
//     and a hit never revalidates. Held apart from the app cache because a
//     warmed route is ~100MB per user: shipping a new app version must not
//     throw that away (it used to, and sw.js ships several times a day).
//
//   APP — everything else same-origin, bumped every deploy. App/engine code
//     changes under its own name, so it rides STALE-WHILE-REVALIDATE: the
//     cached copy paints instantly (the origin sends no-cache, so pre-SW every
//     visit revalidated ~20 files serially) while a background fetch refreshes
//     the copy for the NEXT load — a deploy lands one reload later, which the
//     ship flow tolerates. engine/faust/dist/** belongs HERE, not in media:
//     compiled wasm is CODE, a .dsp recompile changes the bytes under an
//     unchanged filename, and the deploy deliberately does not mark it
//     immutable — cache-first served those recompiles stale until the next bump.
//
// Cross-origin requests are passed through untouched, but there are none left
// to speak of: preact/htm and the two webfonts are vendored, and
// found sound resolves only to local files. Everything the app needs to boot is
// same-origin and therefore cacheable, which is what makes offline boot work at
// all — a cross-origin dependency here would be uncacheable and fatal.
// Cached Response objects keep their original headers, so COOP/COEP isolation
// (SharedArrayBuffer for the render worker) survives offline replay.

const VERSION = "v117";                       // bump every deploy that must reach users
const APP_PREFIX = "stellate-app-";
const APP_CACHE = APP_PREFIX + VERSION;
const MEDIA_CACHE = "stellate-media-v1";     // NOT tied to VERSION — see above
const LEGACY = /^stellate-v\d+$/;            // the pre-split single cache (app + media together)

// Media is versioned-by-name, so it may live in a cache no deploy ever sweeps.
// Two exceptions inside found/ are NOT versioned-by-name and must stay
// refreshable — nginx serves both no-cache for the same reason (HOSTING.md §5):
// every *.json manifest, and tw_vocal.mp3, which tools/build/sing.py re-sings under a
// fixed name. Anything matching MUTABLE rides the app cache's revalidation
// instead; putting it in MEDIA_CACHE would freeze it on every client forever.
const IMMUTABLE = /^\/found\//;
const MUTABLE = /^\/found\/(?:.*\.json|tw_vocal\.mp3)$/;
const reroot = (p) => p.replace(/^.*?(?=\/(found|engine|app|vendor|test|how|index|access|embed|assets|oembed|colophon|feed|manifest)\b)/, "");   // tolerate a sub-path deploy
const isMedia = (p) => {
  const q = IMMUTABLE.test(p) ? p : reroot(p);
  return IMMUTABLE.test(q) && !MUTABLE.test(q);
};

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    for (const k of await caches.keys()) {
      if (k === APP_CACHE || k === MEDIA_CACHE) continue;
      const legacy = LEGACY.test(k);
      if (!legacy && !k.startsWith(APP_PREFIX)) continue;   // not one of ours: leave it alone
      if (legacy) await salvage(k);
      await caches.delete(k);
    }
  })());
});

// One-time migration: the pre-split cache held media and app code together, so
// dropping it wholesale would make the deploy that FIXES the wipe perform one
// last wipe. Lift its /found/ entries across first.
async function salvage(key) {
  try {
    const old = await caches.open(key), media = await caches.open(MEDIA_CACHE);
    for (const req of await old.keys()) {
      if (!isMedia(new URL(req.url).pathname)) continue;
      if (await media.match(req)) continue;
      const res = await old.match(req);
      if (res && res.status === 200) await media.put(req, res);
    }
  } catch (err) { /* quota, or a concurrent activate already took it: media re-warms by playing */ }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // same-origin only
  if (url.pathname.startsWith("/gc/")) return;           // analytics beacons: network-only, never cached
  if (isMedia(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;                               // immutable: a hit never revalidates
      const res = await fetch(req);
      // 206 is illegal in Cache Storage (an <audio> Range request) and a partial
      // body would be a broken hit anyway — store whole 200s only.
      if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
  } else {
    // STALE-WHILE-REVALIDATE: cached copy NOW, fresh copy in the background.
    e.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const hit = await cache.match(req, { ignoreSearch: url.pathname.endsWith(".html") || url.pathname === "/" });
      const refresh = fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {}); return res; });
      if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
      return await refresh;
    })());
  }
});
