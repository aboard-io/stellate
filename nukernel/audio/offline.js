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
//
// THE HOLD (Paul, 2026-08-27, from a train: "Please cache everything you need
// to play one song it keeps cutting out while I'm going into tunnels"). The
// samples were held and THE CODE THE CAST RESOLVES TO WAS NOT. Measured on the
// artifact, second visit, changing the record to London 1985 (synthduo): the
// warm below fetched 14 files and the worker filed them, and then PRESS PLAY
// went to the network for 29 more — juno60, solina, oberheim, stk_guitar,
// voice_lead, voice_choir, kick909, snare_clap, hat_metal, insert_chorus,
// insert_leslie, insert_higain, reverb_dattorro and rev_bleed, each as
// `-module.wasm` + `-meta.json`. In a tunnel every one of those fails, the
// voices never seat, and what a hand gets is "declared but never arriving" at
// full size. Measured with the wire cut on a record never visited: 41 failed
// requests, no sound for 23.7 s, and the readout still saying "starting…".
//
// So the hold enumerates the CURRENT RECORD's whole asset set — samples, the
// soundfont's own data, the DX7 cartridge and every Faust module the cast
// resolves to — and fetches it before it can be missed. Nothing here is a
// typed list of files: the samplers come from the registries, the module names
// come from the bars the composer wrote, and `engine/faust/dist/manifest.json`
// is asked which of those names is a module that exists.
//
// AND THE WORKER'S FETCHES COUNT, which was worth measuring rather than
// assuming: the render worker is a real module Worker spawned from a controlled
// page (engine/faust/live/live.js, `new Worker(BASE + "stream-worker.js",
// {type:"module"})`), so the service worker DOES answer its fetches — measured
// with the wire cut, a worker fetch of stream-worker.js, dx7-presets.json,
// fx_bus-module.wasm and an ahh_choir zone each returned 200 from the cache.
// That is what makes warming from the PAGE the whole fix: the URL the page
// pulls is the URL the worker's own fetch hits.
//
// AND THE HOLD HAS TO BE LOOKING AT THE RECORD WHEN IT COUNTS (2026-08-27,
// second measurement, on the record a hand LANDS on rather than one it picks
// off the atlas). Everything above was true and the boot record was still not
// held: ui/eight.js push(true) calls the warm at ~300 ms, and the cast — the
// `GenreKernel` global that owns SAMPLERS and everything compile() resolves
// against — does not exist until ~1 s. So the boot warm compiled nothing,
// walked no bars, filed five files, found ZERO modules, and holdLine() said
// "held — plays offline" over a record it had never read. Wire cut, press play:
// 24 unanswered requests and a 42.6 s hole in a 60 s run, under a readout that
// said held. Three answers, all in this file, because "when is the record ready
// to be held" is the hold's question and not the page's:
//   · `sawRecord` — a warm that walked no bars cannot say held (holdLine);
//   · `settle()` — the warm comes back, backing off, until a compile answers
//     with bars, so the boot record holds itself without eight.js being asked
//     to call at a better moment;
//   · `heal()` — the daylight between two tunnels is when what failed gets
//     another chance, which nothing used before: a lost file sat in `want`,
//     out of `queue`, until the record changed.
// Measured after, on cold browser contexts (test/commute.test.js): boot record
// held in 0.3 s with 24 modules, and three runs — tunnel, cold reload in the
// tunnel, three tunnels in one play — at 0 holes over 250 ms and 0 unanswered
// requests.
import { warmSources, unitTable, compile, barCount, barPlan, parentState, deps } from "./plan.js";
import { FONT, fontUrl } from "./fonts.js";
import { on, MASTER, BUSES } from "../ui/state.js";
import { masterState } from "./desk.js";

const SITE = new URL("../../", import.meta.url).href;   // the site root, from /nukernel/audio/
const shellDone = new Set();                            // the shell, asked for once ever

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.addEventListener("message", (e) => {
      const d = e.data;
      if (d && d.type === "sw:activated" && d.replaced) newVersion(d.version);
    });
    navigator.serviceWorker.register(new URL("sw.js", SITE).href)
      .then((reg) => { if (reg) watchForNew(reg); }).catch(() => {});
  } catch (e) { /* file:// or a browser that will not have it */ }
}

/* ---------- WHEN THE DEPLOY ARRIVES, THE PAGE SAYS SO -------------------
   Paul, 2026-08-27: *"I clicked rewrite multiple times and never saw a
   different seed."* Measured: on a fresh browser context the deployed page
   worked, and his did not — his browser was painting yesterday's scripts out
   of the app cache, because stale-while-revalidate refreshes the copy for the
   NEXT load (sw.js, top). The worker now says when it has replaced a version;
   this decides what to do about it, and the rule is Paul's own: A RELOAD
   MID-SONG IS WORSE THAN THE BUG.

   FREE, OR ASK. A reload is FREE while nothing has played and the page is
   seconds old — nobody has typed a word, no sound is running, and this is
   exactly the case that produced the report: open the box, the worker
   updates a moment later, and without this the first thing you touch is old
   code. After that it is not free — a record on the desk is somebody's work
   and the transport may be running — so the page prints one line with a
   button and waits to be told.

   ONCE PER VERSION, AND THE MARK IS WRITTEN BEFORE THE RELOAD. sessionStorage
   is per-tab and survives a reload, which is exactly the memory a
   reload-loop guard needs: a worker that activates again in the reloaded page
   finds its own mark and prints the line instead of reloading a second time.
   With storage refused (a locked-down browser) the guard cannot be written,
   so the reload is not taken at all and the line is printed — a box that
   asks twice is a nuisance, a box that reloads forever is broken. */
const BOOTED = Date.now();
const FREE_MS = 20000;             // "seconds old", said in a number
let everPlayed = false, toldNew = "";
try { on("transport:state", (d) => { if (d && d.playing) everPlayed = true; }); } catch (e) {}

function newVersion(version) {
  const v = String(version || "new");
  if (toldNew === v) return;                       // one worker, one word
  toldNew = v;
  const key = "nu.sw.reloaded." + v;
  let marked = null;
  try { marked = sessionStorage.getItem(key); } catch (e) { marked = "no-storage"; }
  const free = !everPlayed && Date.now() - BOOTED < FREE_MS && marked === null;
  if (free) {
    try { sessionStorage.setItem(key, "1"); } catch (e) { return sayNew(v); }
    location.reload();
    return;
  }
  sayNew(v);
}

// THE LINE, AND IT IS OUTSIDE #app. ui/eight.js draw() empties #app on every
// edit, so a notice mounted inside it would be destroyed by the next
// keystroke — the same reason #engine sits under the bar and not in it. The
// button is the only thing on the page that reloads: the page never decides
// for a hand once a hand is working.
function sayNew(v) {
  let p;
  try { p = document.getElementById("swnew"); } catch (e) { return; }
  if (p) return;
  try {
    p = document.createElement("p");
    p.id = "swnew";
    p.className = "nu-new";
    p.textContent = "a new version of the box is ready (" + v + ") — ";
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "reload";
    b.addEventListener("click", () => { location.reload(); });
    p.appendChild(b);
    const bar = document.querySelector(".nu-bar");
    if (bar && bar.parentNode) bar.insertAdjacentElement("afterend", p);
    else document.body.insertBefore(p, document.body.firstChild);
  } catch (e) { /* a page with no body yet: the next load is fresh anyway */ }
}

// AND A TAB THAT WAS LEFT OPEN ASKS, rather than waiting to be told. A
// registration only re-checks its script on a navigation, so a box open since
// this morning would sit on the old code all day with nothing to trigger the
// activation that speaks. Coming back to the tab is the honest moment to ask,
// and it costs one conditional request against a no-cache script.
function watchForNew(reg) {
  const ask = () => { try { reg.update(); } catch (e) {} };
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ask();
    });
  } catch (e) {}
}

// EVERY SAMPLE THE CAST CAN ASK FOR, fetched once. Bounded on purpose: a
// phone on a metered connection should not download a crate because a genre
// was called, and the cast of one record is small (measured: a rock record
// is 30-odd files) — but the fence is here so a future record cannot become
// a flood without somebody moving this number.
//
// THE MODULES GET THEIR OWN FENCE and not a share of this one, because they
// are a different size of thing and must never be crowded out by a crate: the
// whole of engine/faust/dist is 94 modules and 4.5 MB, ~48 KB a module, and
// one record's cast measured 14 of them (28 files). A record whose samples hit
// CAP would otherwise have arrived with no code to play them.
const CAP = 120, MODCAP = 220, PARALLEL = 4;

/* ---------- the ledger the readout reads ---------- */
// `want` is THIS record's whole asset set, rebuilt on every warm; `secured` is
// every url that has come back 200 in this session (the worker has it, and a
// genre you return to is held the instant it is named); `lost` is what would
// not come, by url, so the sentence can NAME it instead of going quiet.
let want = [];
const secured = new Set();
const lost = new Map();
const unknown = new Set();       // module names the manifest does not carry
let queue = [], running = 0, gen = 0, lastExtra = null, armedWarm = false;
// WHETHER THE LAST WARM WAS LOOKING AT A RECORD AT ALL — see `settle()` below.
// Until this is true the hold has counted something, but not the song.
let sawRecord = false, settleTries = 0, settleTimer = 0, healTimer = 0, healWait = 5000;

const MANIFEST = new URL("engine/faust/dist/manifest.json", SITE).href;
let manifestP = null, MODULES = null;
// THE ONE OWNER OF "WHICH MODULES EXIST". A list of module names typed here
// would rot the first time a .dsp is added or renamed; the build already
// writes one, and it is 164 KB fetched once per session and then held.
function manifest() {
  return manifestP || (manifestP = fetch(MANIFEST)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => { MODULES = new Set(Object.keys(j)); secured.add(MANIFEST); })
    .catch(() => { MODULES = null; }));
}

// WHICH FAUST MODULES THIS RECORD RESOLVES TO, taken off the record itself.
// Every carrier of a module name in this box's dialects is a `module` field —
// a pitched voice's model, a drum machine's chip, an insert in a strip's chain
// (state-engine insertChain: `{type, module, params}`), the master chip — so
// the walk asks for that field wherever it appears rather than knowing the
// shapes. Every bar, because the KIT can change between boxes and a module
// seated only in the last box is exactly the one that arrives in a tunnel.
function castModuleNames() {
  const names = new Set();
  const scan = (v, d) => {
    if (!v || typeof v !== "object" || d > 5) return;
    if (Array.isArray(v)) { for (const x of v) scan(x, d + 1); return; }
    if (typeof v.module === "string") names.add(v.module);
    for (const k in v) { const x = v[k]; if (x && typeof x === "object") scan(x, d + 1); }
  };
  try { for (let i = 0, n = barCount(); i < n; i++) { const b = barPlan(i); if (b) scan(b.units, 0); } } catch (e) {}
  try { scan(unitTable(), 0); } catch (e) {}
  return names;
}

// `extra` is a list of site-relative paths the caller knows this record
// needs beyond the plan's own cast — today that is the piano-audition
// zones for the theme's span (ui/band.js hands in audition.js
// zoneFilesFor), so "hear it on the piano" works with the wire cut.
export function warmCache(extra) {
  if (!("serviceWorker" in navigator)) return;
  if (extra) lastExtra = extra;
  // THE PLAN FIRST. The warm runs on a record change, and the unit table it
  // reads is whatever the LAST compile left — so a chair that just joined
  // (measured: the singer, eighteen ahh_choir zones) was warmed on the next
  // change instead of this one, which with the wire cut is never.
  try { compile(); } catch (e) {}
  // ...AND WHETHER THERE WAS A RECORD TO READ. Measured 2026-08-27 on the
  // artifact: the boot warm runs at ~300 ms from ui/eight.js push(true), and
  // `window.GenreKernel` — the classic global that IS the cast (SAMPLERS, and
  // what compile() resolves against) — does not exist until ~1 s. So the boot
  // warm compiled nothing, walked no bars, found no modules and no sampler,
  // filed five files, and the sentence said "held — plays offline" over a
  // record it had never seen. With the wire then cut: 24 unanswered requests at
  // press-play and a 42.6 s hole in a 60 s play. `barCount()` is the honest
  // test — a record that compiled has bars — and it is read HERE, once, so the
  // ledger and the sentence agree about the same warm.
  let bars = 0; try { bars = barCount() | 0; } catch (e) { bars = 0; }
  sawRecord = bars > 0;
  const my = ++gen;                       // a later record change wins the ledger
  want = []; queue = [];
  const seen = new Set();
  let nRec = 0, nMod = 0;
  const add = (p, mod) => {
    if (!p) return;
    let href; try { href = new URL(p, SITE).href; } catch (e) { return; }
    // CROSS-ORIGIN IS WHAT THE WORKER CANNOT CACHE, and the test used to be
    // "does it start with http" — which also threw away every ABSOLUTE
    // same-origin url, and fonts.js hands the hold exactly one of those.
    if (typeof location !== "undefined" && href.indexOf(location.origin + "/") !== 0) return;
    if (seen.has(href)) return;
    seen.add(href);
    if (mod) { if (++nMod > MODCAP) return; } else if (++nRec > CAP) return;
    want.push(href);
    if (!secured.has(href)) queue.push(href);
  };
  // (0) the STAFF — the theme renders as sheet music through the vendored
  // abcjs chunk, which ui/band.js loads lazily on first need (a script
  // element, never on boot). One same-origin file, and it goes in AHEAD of
  // the cast so the CAP can never crowd it out: a warmed record must be able
  // to draw its staff with the wire cut.
  add("vendor/abcjs/abcjs-basic-min.js");
  // (0b) the AUDITION — the piano zones the theme's own span would pull
  // ("hear it on the piano" beside the staff). Ahead of the cast for the
  // same reason as the staff chunk: a handful of files, never crowded out.
  for (const p of lastExtra || []) add(p);
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
  // (c) the SOUNDFONT'S OWN DATA. A sampled font that is merely CHOSEN is not
  // a font: audio/fonts.js fetches `data/font-<key>.json` and registers it on
  // the kernel, and until that lands applySampledOnly answers with fluidr3's
  // zones. In a tunnel the record would play — in the wrong instruments. The
  // url comes from fonts.js's own rule (fontUrl), which also owns the two
  // fonts that HAVE no file, so the hold cannot disagree with the fetch.
  try { add(fontUrl(FONT)); } catch (e) {}
  // (d) the DX7 CARTRIDGE, and unconditionally rather than "when a DX7 voice
  // is seated". engine/faust/live/stream-worker.js:217 fetches it at WORKER
  // BOOT, before it knows what the record contains, and so does stem-worker
  // (:445) and engine.js (:95); a worker booted in a tunnel takes the catch
  // and every DX7 patch on the page becomes a bare FM drone with no error
  // anywhere. It is 656 KB, once per deploy, and the page fetches it on every
  // worker boot anyway — holding it SAVES a phone data over a session.
  add("engine/faust/data/dx7-presets.json", true);
  pump();
  // (e) THE CODE THE CAST RESOLVES TO — the modules, which need the manifest
  // and the state-engine, so they arrive on a promise and JUMP THE QUEUE when
  // they do (below): without a module there is no sound at all, and a module
  // is a fifth of the size of a sample zone.
  holdModules(my);
  armTransportWarm();
  settle();
  armHeal();
}

// THE WARM COMES BACK UNTIL THERE IS A RECORD TO WARM. The page calls this
// once per record change (ui/eight.js push), and the FIRST of those calls is
// the boot one, which is too early — see the note in warmCache. Rather than
// asking the page to call again at a better moment (a second owner of "when is
// the record ready", and a file this slice does not own), the hold retries
// itself: at idle, backing off, until a compile answers with bars. Bounded, and
// the ceiling is spoken aloud rather than passed over in silence — a hold that
// quietly stops trying is the same lie in a slower voice.
const SETTLE = [250, 400, 700, 1200, 2000, 3000, 4000, 6000, 8000, 8000, 8000, 8000];
function settle() {
  if (sawRecord) { settleTries = 0; if (settleTimer) { clearTimeout(settleTimer); settleTimer = 0; } return; }
  if (settleTimer || settleTries >= SETTLE.length) return;
  const d = SETTLE[settleTries++];
  settleTimer = setTimeout(() => { settleTimer = 0; atIdle(() => warmCache()); }, d);
}

// AND THE WIRE COMES BACK TOO. A tunnel is not one event, it is a sequence: the
// stretch of daylight between two tunnels is the only chance the record has to
// finish arriving, and before this nothing used it — a file that failed stayed
// in `want`, out of `queue`, unasked-for until the record changed or the
// transport was pressed again. Measured: with the wire cut and restored, the
// ledger sat at "held all but 24" through the whole restored stretch.
//
// `online` is listened for AND a slow retry runs anyway, because navigator's
// idea of online is famously wrong on a train (a captive tunnel repeater
// answers DHCP and nothing else). The retry backs off to 30 s and stops dead
// the moment nothing is missing, so a held record costs nothing.
function missing() { return want.filter((u) => !secured.has(u)); }
function heal() {
  const miss = missing();
  if (!miss.length) { healWait = 5000; return; }
  for (const u of miss) if (queue.indexOf(u) < 0) queue.push(u);
  pump();
}
function armHeal() {
  if (healTimer) return;
  const tick = () => {
    healTimer = 0;
    if (!missing().length) { healWait = 5000; armHeal(); return; }   // idle, cheap, still watching
    heal();
    healWait = Math.min(30000, Math.round(healWait * 1.6));
    armHeal();
  };
  healTimer = setTimeout(tick, healWait);
  try { if (healTimer && healTimer.unref) healTimer.unref(); } catch (e) {}
}
try {
  if (typeof window !== "undefined")
    window.addEventListener("online", () => { lost.clear(); healWait = 5000; heal(); });
} catch (e) {}

async function holdModules(my) {
  await manifest();
  if (my !== gen) return;
  if (!MODULES) {
    // THE LIST ITSELF WOULD NOT COME. Say so rather than guessing at names:
    // an unheld manifest means the modules are unheld, and the sentence names
    // the file a person can go and look at.
    want.push(MANIFEST); lost.set(MANIFEST, "no network");
    return;
  }
  const names = castModuleNames();
  // THE TWO THE RECORD DOES NOT CARRY IN A `module` FIELD, asked of the owner
  // that decides them rather than copied here as strings. The reverb COLOR is
  // resolved from `state.reverbColor` by state-engine reverbColor(), and when
  // a color is live the renderer seats `rev_bleed` beside it
  // (engine/faust/live/stream-renderer.js:713) — measured as two of the 29
  // misses. The multiband master chip is masterMb()'s, and only when a genre
  // opts in.
  try {
    const D = await deps();
    const SE = D && D.SE;
    // THE STATE THE ENGINE ACTUALLY GETS, and not the compiled half of it.
    // audio/live.js getState() spreads audio/desk.js masterState OVER the
    // compiled state, and `reverbColor` lives in the RACK, not in the record's
    // own fields — measured: asking `parentState()` alone left reverb_dattorro
    // and rev_bleed as the last two misses at press-play. Same call to the same
    // owner as live.js makes; nothing here decides what a rack means.
    let st = parentState() || {};
    try { st = { ...st, ...(masterState(MASTER, BUSES, SE) || {}) }; } catch (e) {}
    if (SE && st) {
      const rc = SE.reverbColor && SE.reverbColor(st);
      if (rc && rc.module) { names.add(rc.module); names.add("rev_bleed"); }
      const mb = SE.masterMb && SE.masterMb(st);
      if (mb && mb.module) names.add(mb.module);
    }
  } catch (e) {}
  if (my !== gen) return;
  const mods = [];
  const seen = new Set(want);
  let nMod = 0;
  for (const m of [...names].sort()) {
    // A NAME THE MANIFEST DOES NOT CARRY is not a module this build ships —
    // it is either a dialect word that happens to be spelt `module`, or a
    // model the state-engine could not resolve, which is the bug
    // stream-worker.js throws by name. Skipped, and kept for the report.
    if (!MODULES.has(m)) { unknown.add(m); continue; }
    for (const f of [m + "-module.wasm", m + "-meta.json"]) {
      const href = new URL("engine/faust/dist/" + f, SITE).href;
      if (seen.has(href) || ++nMod > MODCAP) continue;
      seen.add(href); want.push(href);
      if (!secured.has(href)) mods.push(href);
    }
  }
  queue = mods.concat(queue);
  pump();
}

/* ---------- the fetching, at the back of the queue behind the first sound ---- */
// THE HOLD MUST NOT FIGHT THE TAPE. audio/live.js pre-renders chunk 0 at page
// idle (armPrerender → requestIdleCallback), and that render is what makes the
// play gesture cost one Atomics store instead of seven seconds; a hold that
// saturated the connection while it ran would buy the tunnel by spending the
// first note. So the hold YIELDS on both axes it can:
//   · it starts inside requestIdleCallback, so the pre-render's own open (which
//     is armed first, at warmup) has the idle ahead of it;
//   · every fetch goes out at `priority: "low"`, so the engine's own fetches —
//     issued at default priority from the page and from the worker — take the
//     socket first. What the hold pulls is mostly what the pre-render is about
//     to need anyway, so the two are cooperative rather than rival: the second
//     asker gets a cache hit.
// PARALLEL is 4 and not 6 for the same reason.
const atIdle = (fn) => {
  try { (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 600)); }
  catch (e) { setTimeout(fn, 600); }
};
function pump() {
  atIdle(() => { while (running < PARALLEL && queue.length) { running++; step(); } });
}
function step() {
  const href = queue.shift();
  if (!href) { running--; return; }
  // force-cache on MEDIA only: /found/ is versioned-by-name and immutable, so
  // a held copy is right forever. Engine code rides the worker's own
  // stale-while-revalidate instead, or a deploy would be held out of reach.
  const opts = { priority: "low" };
  if (href.indexOf("/found/") >= 0) opts.cache = "force-cache";
  fetch(href, opts).then((r) => {
    if (r && r.ok) { secured.add(href); lost.delete(href); }
    else lost.set(href, "HTTP " + ((r && r.status) || "?"));
  }).catch(() => { lost.set(href, "no network"); }).then(step);
}

// AND AGAIN WHEN THE TRANSPORT ARMS. The warm runs on a record change, but a
// record can be edited for ten minutes afterwards — a chair added, a font
// changed, a genre stacked into a box — and each of those recompiles the cast
// without calling the warm. Pressing play is the last honest moment to hold
// what the record has BECOME, and it costs nothing when nothing moved:
// everything already secured is skipped by url.
function armTransportWarm() {
  if (armedWarm) return;
  armedWarm = true;
  // AT IDLE, NEVER IN THE GESTURE. `transport:state` is emitted from inside
  // audio/live.js startAt BEFORE `h.release()`, so a listener that recompiled
  // on the spot would spend the play gesture — the exact cost the idle
  // pre-render was built to remove. The warm is queued behind the first sound.
  try { on("transport:state", (d) => { if (d && d.playing) atIdle(() => warmCache()); }); } catch (e) {}
}

/* ---------- what the hold can say for itself ---------- */
const shortName = (href) => {
  try { const p = new URL(href).pathname.split("/"); return p.slice(-2).join("/"); }
  catch (e) { return href; }
};
// THE SENTENCE, for audio/live.js engineLine() to carry. It is a claim about
// whether this record can leave the platform, so it counts FILES and not
// promises: "held" means every url this record resolves to has come back 200
// at least once in this session, which is the same thing as the worker having
// it. A file that would not come is NAMED — a hold that fails quietly is worse
// than no hold, because a quiet hold is what a person trusts on a train.
export function holdLine() {
  if (!want.length) return "";
  let got = 0;
  for (const u of want) if (secured.has(u)) got++;
  // A WARM THAT NEVER SAW THE RECORD CANNOT SAY THE RECORD IS HELD, however
  // completely it holds what it did count. This is the box's own characteristic
  // bug turned on the hold itself — declared, costed, and reaching no sound —
  // and it is the one claim on this page that a person acts on before a tunnel.
  if (!sawRecord) return settleTries >= SETTLE.length
    ? "not held — the record would not settle"
    : "holding the record";
  if (got === want.length) return "held — plays offline";
  if (!queue.length && !running) {
    const missing = want.filter((u) => !secured.has(u));
    if (missing.length) return "held all but " + missing.length + " — "
      + shortName(missing[0]) + (missing.length > 1 ? " and " + (missing.length - 1) + " more" : "")
      + " would not come";
  }
  return "holding " + got + " of " + want.length;
}
// the same facts as numbers, for a gate to assert on (test/hold.test.js)
export const holdReport = () => ({
  want: want.length, held: want.filter((u) => secured.has(u)).length,
  queued: queue.length, running,
  lost: [...lost.keys()].filter((u) => want.indexOf(u) >= 0),
  sawRecord, settleTries,
  unknown: [...unknown], line: holdLine(),
  modules: want.filter((u) => u.indexOf("/dist/") >= 0).length,
  // the set itself, so a gate can check the LEDGER AGAINST CACHE STORAGE
  // rather than believing a counter written by the code under test
  urls: want.slice(),
});
// THE GATE'S DOOR ONTO THE LEDGER, beside audio/live.js's own __nuEngine and
// __nuEngineLine. test/hold.test.js waits on this before it cuts the wire —
// "wait a while and hope" is how a cache gate comes to pass on a fast box and
// fail on a train.
try { if (typeof window !== "undefined") window.__nuHold = holdReport; } catch (e) {}

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
      if (shellDone.has(u)) continue;
      shellDone.add(u);
      fetch(u, { cache: "reload" }).then((r) => { if (r && r.ok) secured.add(u); }).catch(() => {});
    }
  };
  // ...once the worker is actually in charge of this page's fetches
  if (navigator.serviceWorker.controller) go();
  else navigator.serviceWorker.addEventListener("controllerchange", go, { once: true });
  if (navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(() => setTimeout(go, 200));
}

// WHAT IS WARM, for a gate to ask (ui/band.js __bandWarm). It used to answer
// "every url the warm ASKED for", which counted a failed fetch as a hold; it
// answers what actually came back now.
export const warmed = () => [...secured];
