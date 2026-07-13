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
const VERSION = "stellate-v24";  // v24 (2026-07-13): DOCS + OPEN-SOURCE READINESS. Fixed the stale genre count everywhere (228/249 -> 250; matrix prints 250/250), refreshed the in-app about panel + how.html + README/CLAUDE/CONTRIBUTING, and added a root package.json declaring the one browser-test dep (playwright) so a fresh clone runs the headless gates with NO hardcoded NODE_PATH (the clean-clone blocker). No app-behaviour change. BUMP purges the old cache. (prior v23:) // v23 (2026-07-13): STAR-CRUISE big pass. ALIENS ARE A VIEW now — the ✦ chip cycles map→viz→video→ALIENS→map; the standalone 🛸 chip + ✕ EXIT button are gone; a glitchy VHS scanline overlay sits in front of the 3D view. SCENE: band spaced much wider on a bare little planet (backdrop trees/objects removed), dancers touch the ground, stars have NO halo, and DRAMATIC sweeping colored SPOTLIGHTS replace the flat high-noon lighting. CREATURES read as recognizable Earth animals by genre — dog / dino / gator / robot / human — with alien touches; and their mesh count was cut ~1083→384 (≈35/creature) so it stays mobile-cheap. BUMP purges the old cache. (prior v22:) // v22 (2026-07-13): VAPOR IS NOW BAKED (Paul: "can't vapor take effect over time? like BPM?"). Was a desktop-only live output-graph effect — silent on the pocket-proof mobile WAV path. Now baked into the full-mix stream in stream-renderer.renderChunk (muffle lowpass + 3-comb mall wash + dry duck, filter/reverb state carried across chunk seams), so it rides BOTH the desktop ring AND the mobile WAV segments, and lands OVER TIME like a BPM change (eases in from the next fed bar). Byte-IDENTICAL at vapor 0 (bypassed) so segment-parity/fixtures are untouched (14/14 byte-equal); verified muffle at >0 (highs -> 60%). Live output-graph vapor kept at bypass to avoid double-apply. BUMP purges the old cache. (prior v21:) // v21 (2026-07-12): DURATION slider (the loop's travel time is now dialed directly — 8 min … 24 h, log, default 30 min — replacing bars-per-leg "pace"; speed derives so the WHOLE loop takes that long regardless of path size; URL carries `dur`, legacy `pace` auto-converts). VOID-BLEND: the genre mix keeps evolving across sparse map regions instead of pinning one genre at 100% for hours (the ?path that sat on canawave for 20 min now crosses ~58 genres over a 30-min loop). ADD/REMOVE NODES FIXED: the double-tap-to-add/remove was measured in LOGICAL units (~0.4 screen px on the huge map) so no finger could trigger it — now screen-px (28px, 440ms). BUMP purges the old cache. (prior v20:) // v20 (2026-07-12): star-cruise camera round 2 — FREE-LOOK now PERSISTS while flying (removed the 3.5s auto-recenter that snapped you back — "can't change my view"); landed auto-cam pulled back HARD (closeups dist 7->11, drummer 6.8->10.5, through 9->12 w/ almost no push, minDist 3.6->5) so you always see the WHOLE alien, never "inside" them; and a TOP-DOWN ARRIVAL — the descent looks straight DOWN at the little planet from above, decelerates onto the pad (cubic ease-out), holding the down-gaze then swinging to face the band right at touchdown. BUMP purges the old cache. (prior v19:) // v19 (2026-07-12): star-cruise camera — the landed auto-cam no longer ZOOMS IN so far; closeups/drummer/through pull back to a whole-body FRONT framing (dist 3.6->7.0, minDist 2.2->3.6) so you always see the entire alien, feet to horns. BUMP purges the old cache. (prior v18:) // v18 (2026-07-12): star-cruise — CONTINUOUS space flight (dead-reckon the galaxy->surface ZOOM, not just the pan: per-bar speed spike 5.9x->1.27x, the "moves every 8 bars" lurch gone), FREE-LOOK in transit (drag turns your head while the flight flies the path; gentle recenter) + longer landed look-hold, PLANETS are real little worlds (procedural continents/oceans/ice-caps/atmosphere, one instanced draw call) not colored blobs, SUNS are darker FLAMING stars (churning plasma + sunspots + limb darkening + warm corona), CREATURE-COLLECTION morphology (body.archetype: draconic/quadruped/biped/bot/mollusk/jelly + horns/wings/tails/ears/crests — heavymetal=winged dragons, jazz=eared beasts, vaporwave=glass jellies), genre MATERIALS (fur/rock/wax/chrome/glass), distinct INSTRUMENT shapes (conch/veil/lyre/bell/hanging-bars), and tentacles no longer CLIP the torso (interior FABRIK joints clamped outside the keep-out shell). BUMP purges the old cache. (prior v17:) // v17 (2026-07-12): alien band polish — CUTE VISIBLE FACES (big eyes proud of the body, not buried), JOINTED limbs with visible shoulder/hip + elbow/knee joints, DISTINCT body silhouettes per genre + per-alien (not uniform blobs), FEET PLANTED on the curved ground (were floating 0.3-0.7u; now rest at y~0 casting grounding shadows), real planet SURFACE relief + right-sized foliage. Render-only star-cruise files; no engine touched. BUMP purges the old cache. (prior v16:)  // v16 (2026-07-12): THE LITTLE PRINCE landing — land on a small CURVED procedural planet (9 genre-keyed terrain types) with the city/landscape wrapped on its surface + the band standing ON the little world; SPACE is true BLACK; organic MARCHING-CUBES alien bodies (fused blobs) + hinged-jaw dark-cavity mouths + two-tentacle drummers + no black-circle shadow; and the camera now GLIDES continuously (dead-reckoning ramp — no 8-bar lurch). BUMP purges the old cache. (prior v15:)  // v15 (2026-07-12): UNIFIED scene + continuous camera — the galaxy and the planet surface are now ONE scene, so flying to a planet genuinely DESCENDS onto the band (no more cut); the camera is a critically-damped spring aimed at the continuous weight-blend centroid (no more 8-bar lurch); a real procedural planet (vendored simplex-noise, deterministic) is the ground and feet plant on it. BUMP purges the old cache. (prior v14:)  // v14 (2026-07-12): alien polish — limbs no longer clip through the torso (roots seated on the surface + IK keep-out shell), instruments in bold complementary colours that pop off the body, auto-cam no longer shoots up-from-the-floor (all shots >= eye level), stale flight-run assertion fixed. BUMP purges the old cache. (prior v13:)  // v13 (2026-07-12): nav FEEL rework — galaxy spread ~6.4x with glowing emissive stars + corona (no more pile), critically-damped camera (kills the 8-measure lurch — moves LEAST at each blend update), and a real continuous Google-Maps zoom-land (unified regions, monotonic descent/ascent, no teleport). BUMP purges the old cache. (prior v12:)  // v12 (2026-07-12): expressive puppet FACES — rigged jaw/brows/eyelids/eyes; pupils dart+track, blinks, brows react; the lead vocalist LIP-SYNCS to its onsets, drummer grimaces on hard hits, bass stays closed; per-alien personality. BUMP purges the old cache. (prior v11:)  // v11 (2026-07-12): star-cruise SMOOTH GALAXY — clusters=stars (31 labeled colored suns) + genres=planets, no-bobbing camera, ship removed (2D HUD), floor clamp, flyover/through-city + drummer-on-fills, wider spacing, optional/desynced dancers, contiguous aliens, per-alien colour, superquadric/FABRIK geometry, simplified readable shaders; + folk-coord fix + coords/POS/full-boot gates. BUMP purges the old cache on activate so a deploy lands
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
