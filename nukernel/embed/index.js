// nukernel/embed/index.js — STELLATE IN SOMEBODY ELSE'S PAGE (2026-11-23).
//
//   const { load } = await import("https://…/nukernel/embed/index.js");
//   const radio = await load();            // before or inside the first touch
//   button.onclick = () => radio.play(0.6); // IN the touch: a phone starts
//                                           // sound nowhere else
//   radio.pause(); radio.level(0.4); radio.now();
//
// Paul, 2026-11-23: *"create a branch of stellate that can just be embedded and
// use that in a web page … Adjust stellate to play slow ambient."* The radio
// plays slow ambient records one after another, for ever, through the box's
// own composer and its own engine (./radio.js for how, ./slow.js for what
// "slow ambient" means). This file is only the way IN for a page that has none
// of the box's scripts: it has no imports, so asking for it costs nothing, and
// `load()` brings the rest.
//
// load(opts) — all optional:
//   store      where ui/state.js keeps the volume and the rest
//              (getItem/setItem/removeItem); default: localStorage under
//              "stellate.embed."
//   choose(n, prev, part)  → { genre, seed, key?, seats? }: the host names the
//              next record (a page that knows what is on its screen); default:
//              ./slow.js planAt by the part of the day
//   shape(doc, plan)       default ./slow.js slowRecord
//   beat(pos)  the playhead as it moves; went(on): the engine stopped or
//              started by itself (the lock screen); hidden(): the page is
//              hidden; log(line); sampled: the sampled instruments shipped;
//              bufferSec: seconds kept ahead on the media route (the engine's own, 5-10, unless given)
//
// THE SCRIPTS, IN THE BOX'S OWN ORDER (nukernel/index.html, less its wiki,
// avail, gates, atlas and producer — none of which a radio asks). They are
// classic scripts that publish onto the page, so they are added as <script>s
// and awaited one by one; the engine's four go last because FaustLive reads
// its own folder off the script that loaded it.
export const CLASSIC = [
  "engine/registry-data.js", "engine/faust/voices/sampler.js",
  "engine/faust/voices/found-player.js", "engine/theory.js",
  "nukernel/kernel.js", "nukernel/genres.js", "nukernel/askable.js",
  "nukernel/fields.js", "nukernel/song.js", "nukernel/instruments.js",
  "nukernel/compose.js", "nukernel/presets.js", "nukernel/songs.js",
  "nukernel/document.js", "nukernel/desk-doc.js", "nukernel/knobs.js",
  "nukernel/chair.js", "nukernel/ideas-kit.js", "nukernel/rules.js",
  "nukernel/precompose.js",
  "engine/csd-engine.js", "engine/genre-kernel.js",
  "engine/faust/voices/state-engine.js", "engine/faust/live/live.js",
];
/** How many seconds of sound the media route keeps ahead of the element: 0 is the engine's own (5-10 s). */
export const BUFFER_SEC = 0;
const SITE = new URL("../../", import.meta.url).href;
/* WHERE A SCRIPT IS, IN EITHER LAYOUT (2026-11-23, found the hour this page first
   went to stellate.app: every script came back as the front page's HTML). In
   the repository — and in a host that vendors it whole — the box is
   /nukernel/ beside /engine/. The published site copies nukernel/* to the
   ROOT, so there the same files are /kernel.js beside /engine/. The engine is
   under the site root in both (`../../` from here stops at the root when there
   is nothing above it, exactly as audio/plan.js's ROOTDIR does); the box's own
   scripts are found from THIS file's folder, which is beside them in both. */
const BOX = new URL("../", import.meta.url).href;
const where = (src) => src.startsWith("nukernel/") ? BOX + src.slice("nukernel/".length) : SITE + src;
const came = new Set();
const script = (src) => came.has(src) ? Promise.resolve() : new Promise((ok, no) => {
  const s = document.createElement("script");
  s.src = where(src); s.async = false;
  s.onload = () => { came.add(src); ok(); };
  s.onerror = () => { s.remove(); no(new Error("stellate: " + src)); };
  document.head.append(s);
});
const prefixed = (pre) => ({
  getItem: (k) => { try { return localStorage.getItem(pre + k); } catch (e) { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(pre + k, v); } catch (e) {} },
  removeItem: (k) => { try { localStorage.removeItem(pre + k); } catch (e) {} },
});

let loading = null;
/** The radio, loaded once. A load that failed is forgotten, so the next ask
 *  tries again (and runs no script that already came). */
export function load(opts) {
  return loading || (loading = boot(opts || {}).catch((e) => { loading = null; throw e; }));
}
async function boot(o) {
  const w = window;
  if (!w.__stellateStore) w.__stellateStore = o.store || prefixed("stellate.embed.");
  if (!w.__GENRES) w.__GENRES = { GENRES: {} };
  for (const s of CLASSIC) await script(s);
  /* THE ROUTE, WHERE THE PAGE IS NOT CROSS-ORIGIN ISOLATED. The box's own
     pages are served with COOP/COEP and open the ring; a host page usually is
     not, and there every start fails once on the ring before audio/live.js
     demotes itself to the media route. Asking for the media route at the door
     skips the failure. Only the route is chosen here, never a bar. */
  const FL = w.FaustLive;
  /* AND A DEEP BUFFER ON THE MEDIA ROUTE (o.bufferSec, default BUFFER_SEC). A
     radio is steered by nobody, and a phone's page behind another app gets
     audio into its element slower than it plays (the engine's own note at
     FEED_CAP_MP3, and nukernel/embed/heartbeat.js for how that was seen). The
     buffer is what the page lives on while it is away. Its price is said
     there too: on a phone a move of the volume is heard this much later. */
  /* ...AND IT IS OFF UNLESS ASKED FOR, SINCE THE SAME AFTERNOON. With 30 s asked
     for, Paul's iPhone never got going: the element sat at t=0 for the three
     seconds the engine's frozen-clock watchdog allows after the first append
     (a render that deep, all at once, on a phone), the AAC route was demoted
     to segAB, and segAB there plays seventeen seconds and rests seventeen. And
     the starving it was meant to cover turned out not to be the phone's doing
     at all (engine/faust/live/live.js THE EVICTION THAT ATE THE PUMP). So the
     default is the engine's own depth; a host may still ask (o.bufferSec),
     and a deep buffer wants a slower fill before it is the default again. */
  const bufferSec = o.bufferSec > 0 ? o.bufferSec : BUFFER_SEC;
  if (FL && !FL.__embedRoute) {
    const open = FL.exploreLive.bind(FL);
    FL.exploreLive = (g, s, opts) => open(g, s, Object.assign({}, opts,
      self.crossOriginIsolated ? {} : { wavOut: true }, bufferSec > 0 ? { feedCapSec: bufferSec, fwdCapSec: bufferSec + 15 } : {}));
    FL.__embedRoute = true;
  }
  /* THE BACKGROUND WAV IS NOT ASKED FOR. On the ring, a hidden Safari tab asks
     the stream worker to render a WAV to hand the sound to an element
     (engine/faust/live/live.js BACKGROUND-WAV HANDOFF). A nukernel record's
     state has no `progression`, the render fails, and the ask is repeated the
     instant it fails — a hundred times a second. Until the engine learns not
     to ask for what it cannot render, the message is not sent; one never
     answered also keeps it from asking again. */
  if (!w.__noBgWav) {
    w.__noBgWav = 1;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, t) {
      if (!m || m.type !== "renderWav") return post.call(this, m, t);
    };
  }
  const [{ makeStellate }, { makeRadio }] = await Promise.all([import("./stellate.js"), import("./radio.js")]);
  const S = await makeStellate(o);
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] || 1);
  const radio = makeRadio(Object.assign({ hidden: () => document.hidden }, o, { S, seed }));
  return Object.assign(radio, { stellate: S });
}
