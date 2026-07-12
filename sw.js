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
const VERSION = "stellate-v18";  // v18 (2026-07-12): star-cruise — CONTINUOUS space flight (dead-reckon the galaxy->surface ZOOM, not just the pan: per-bar speed spike 5.9x->1.27x, the "moves every 8 bars" lurch gone), FREE-LOOK in transit (drag turns your head while the flight flies the path; gentle recenter) + longer landed look-hold, PLANETS are real little worlds (procedural continents/oceans/ice-caps/atmosphere, one instanced draw call) not colored blobs, SUNS are darker FLAMING stars (churning plasma + sunspots + limb darkening + warm corona), CREATURE-COLLECTION morphology (body.archetype: draconic/quadruped/biped/bot/mollusk/jelly + horns/wings/tails/ears/crests — heavymetal=winged dragons, jazz=eared beasts, vaporwave=glass jellies), genre MATERIALS (fur/rock/wax/chrome/glass), distinct INSTRUMENT shapes (conch/veil/lyre/bell/hanging-bars), and tentacles no longer CLIP the torso (interior FABRIK joints clamped outside the keep-out shell). BUMP purges the old cache. (prior v17:) // v17 (2026-07-12): alien band polish — CUTE VISIBLE FACES (big eyes proud of the body, not buried), JOINTED limbs with visible shoulder/hip + elbow/knee joints, DISTINCT body silhouettes per genre + per-alien (not uniform blobs), FEET PLANTED on the curved ground (were floating 0.3-0.7u; now rest at y~0 casting grounding shadows), real planet SURFACE relief + right-sized foliage. Render-only star-cruise files; no engine touched. BUMP purges the old cache. (prior v16:)  // v16 (2026-07-12): THE LITTLE PRINCE landing — land on a small CURVED procedural planet (9 genre-keyed terrain types) with the city/landscape wrapped on its surface + the band standing ON the little world; SPACE is true BLACK; organic MARCHING-CUBES alien bodies (fused blobs) + hinged-jaw dark-cavity mouths + two-tentacle drummers + no black-circle shadow; and the camera now GLIDES continuously (dead-reckoning ramp — no 8-bar lurch). BUMP purges the old cache. (prior v15:)  // v15 (2026-07-12): UNIFIED scene + continuous camera — the galaxy and the planet surface are now ONE scene, so flying to a planet genuinely DESCENDS onto the band (no more cut); the camera is a critically-damped spring aimed at the continuous weight-blend centroid (no more 8-bar lurch); a real procedural planet (vendored simplex-noise, deterministic) is the ground and feet plant on it. BUMP purges the old cache. (prior v14:)  // v14 (2026-07-12): alien polish — limbs no longer clip through the torso (roots seated on the surface + IK keep-out shell), instruments in bold complementary colours that pop off the body, auto-cam no longer shoots up-from-the-floor (all shots >= eye level), stale flight-run assertion fixed. BUMP purges the old cache. (prior v13:)  // v13 (2026-07-12): nav FEEL rework — galaxy spread ~6.4x with glowing emissive stars + corona (no more pile), critically-damped camera (kills the 8-measure lurch — moves LEAST at each blend update), and a real continuous Google-Maps zoom-land (unified regions, monotonic descent/ascent, no teleport). BUMP purges the old cache. (prior v12:)  // v12 (2026-07-12): expressive puppet FACES — rigged jaw/brows/eyelids/eyes; pupils dart+track, blinks, brows react; the lead vocalist LIP-SYNCS to its onsets, drummer grimaces on hard hits, bass stays closed; per-alien personality. BUMP purges the old cache. (prior v11:)  // v11 (2026-07-12): star-cruise SMOOTH GALAXY — clusters=stars (31 labeled colored suns) + genres=planets, no-bobbing camera, ship removed (2D HUD), floor clamp, flyover/through-city + drummer-on-fills, wider spacing, optional/desynced dancers, contiguous aliens, per-alien colour, superquadric/FABRIK geometry, simplified readable shaders; + folk-coord fix + coords/POS/full-boot gates. BUMP purges the old cache on activate so a deploy lands
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
