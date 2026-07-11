// video-layer.js — LIVE laserdisc background, streamed straight from archive.org.
//
// New direction (2026-07): clips STREAM from the Internet Archive — no pre-bake.
//   <video src="https://archive.org/download/<item>/<file>#t=<in>"> plays a cue
//   window (found/video/stream-catalog.json = committed source); the browser does
//   the grading with CSS + SVG filters on top. The local found/video/*.mp4 clips
//   are now an OPTIONAL cache + the slow-network / archive-blocked FALLBACK tier.
//
// Streaming plays cross-origin WITHOUT `crossorigin` (like an <img>): archive's
// /download 302 carries `access-control-allow-origin:*` but the CDN node it
// redirects to does NOT — so a `crossorigin=anonymous` video (needed to sample
// into WebGL) would taint/fail. Hence effects are CSS + SVG-filter only
// (compositor-level, no pixel readback, no CORS, cheap on the audio thread).
//
// Two stacked <video> elements: the front plays; the back PRELOADS the next clip
// while it does. We crossfade only once the back is genuinely ready (readyState
// >= HAVE_FUTURE_DATA) — if the next stream isn't ready at switch time we HOLD
// the current clip (never black). A slow/failed remote falls back to the local
// cache clip when present. Clip advance is driven by the bar clock (explorer
// calls showFile every 8 measures); effects are keyed off the playing genre.
//
//   VideoLayer.init()            -> Promise<boolean> (any clips available?)
//   VideoLayer.setEnabled(on)    -> show/hide (idempotent; state is OWNED by the
//                                   background program in app/background.js —
//                                   this layer never re-enables itself)
//   VideoLayer.enabled()         -> current state
//   VideoLayer.available()       -> layer loaded?
//   VideoLayer.showFile(file)    -> stream/crossfade to clip "<name>.mp4"
//   VideoLayer.setGenre(genre)   -> ease the effect stack to a genre look
//   VideoLayer.idle()            -> resume slow ambient cycling
//   VideoLayer.makeBag()         -> shared no-repeat shuffle bag (explorer pools)
//   VideoLayer.credits()         -> [{file,credit}] for attribution UI

(function (root) {
  "use strict";

  const MOBILE = /Mobi|iPhone|iPad|Android/.test(navigator.userAgent) ||
                 (navigator.hardwareConcurrency || 8) <= 4;
  // Paul 2026-07-06: the video transitions and effects should be 10x slower.
  // ONE dial — the SLOW-BROADCAST sibling of WACKADOODLE (declared far below,
  // next to the chaos scheduler). SLOTH multiplies every visual MOTION —
  // crossfades, tape wobbles, chaos-event durations, grade/effect easings,
  // OSD/caption/card holds — so the station stops twitching and starts
  // dreaming: long dissolves, effects that arrive like weather. Event RATE is
  // deliberately untouched — the serial chaos scheduler spaces itself out
  // naturally as event durations grow (fewer, longer events per minute). It
  // lives HERE, not next to WACKADOODLE, only because FADE_MS below needs it.
  // 2026-07-06 (deeper pass): 10 -> 16. Everything is slower still — now that
  // the motion is this geological it reads as ORGANIC, so the amplitudes get to
  // grow to match (see DRAMA). FADE_MS stays clamped to FADE_CAP (the crossfade
  // must still finish inside the 8-bar switch window); the standby/colorbars
  // holds stay capped at 8s (furniture must never squat the frame).
  // 2026-07-06 (deepest pass): 16 -> 64. Paul: transforms/zooms/squeezes "EVEN
  // SLOWER, like 1/4th that slow. They shouldn't be obvious." Motion now moves
  // at tectonic speed — you should never CATCH a transform happening, only
  // notice the frame is somewhere else than it was a minute ago. The chaos
  // scheduler self-spaces (period rides SLOTH too), so events also get 4x
  // rarer per wall-clock; FADE_MS and the furniture holds stay capped as above.
  const SLOTH = 64;
  // DRAMA — the sibling amplitude dial (Paul 2026-07-06: "make the effects more
  // dramatic, since they're now going so slow it feels organic"). SLOTH governs
  // how SLOW motion is; DRAMA governs how BIG each event's excursion is —
  // deeper chroma lurches, farther vertical rolls, heavier ghosts, wider zooms,
  // stronger displacement storms, deeper brightness pumps, bolder leans. 1 =
  // the old reach; ~1.6 = geological + huge. The never-unwatchable guardrail
  // still stands: amplitudes are clamped so the FOOTAGE stays the subject
  // (rotations ride a cover-scale so corners never expose; brightness/smear are
  // capped). Declared up here beside SLOTH so burst() (above WACKADOODLE) sees it.
  const DRAMA = 1.6;
  const FADE_CAP = 8000;   // a full crossfade must finish INSIDE the 8-bar switch window; at the fastest genre (~187 bpm) 8 bars ≈ 10.3s, so cap at ~80% of it
  // Desktop: 1600 * SLOTH lands way past FADE_CAP now, so every dissolve rides
  // the cap — 8s flat, the slowest a crossfade can be without running past
  // the next switch (which would strand a half-faded frame). Mobile: WAS a 0ms
  // hard cut (the loader stayed paused to avoid a 2nd live decoder janking
  // touch); two <video>s are present now, so give the phone a slow opacity
  // DISSOLVE — compositor-only, held to 3s (not the full 8s) to bound the brief
  // dual-decode window on touch hardware.
  const FADE_MS = MOBILE ? 3000 : Math.min(1600 * SLOTH, FADE_CAP);
  const IDLE_CYCLE_MS = 24000;   // ambient switch period when nothing is playing (a clip-RATE, left as-is — already dreamy)
  const RATE = 0.35;             // slowed playback — dreamier, more VHS (Paul 2026-07-06: slower still; cue windows are 15-45s of media = 42-128s wall at 0.35x, plenty for 8 measures; the [in,out] loop-seek is media-time so RATE doesn't touch it)
  // NO localStorage self-restore (2026-07-09): the layer used to remember its own
  // on/off ("vaporwave-video-on") and re-enable itself when init() resolved —
  // BYPASSING the background mode program, which is how video and the demoscene
  // layer ended up visible ON TOP of each other (Paul). app/background.js is now
  // the single owner of both layers' enabled state (it persists the MODE).
  const REMOTE_READY_MS = 3800;  // archive.org latency budget before we fall back to the local cache clip
  // A PREFETCH (loading the next clip while the current one still has ~8 bars
  // to play) gives remote most of the window — capping it at REMOTE_READY_MS
  // meant a slow-but-reachable stream could never win, only fail earlier
  // (2026-07-06 re-verification finding). If the show arrives while remote is
  // still loading, loadBack's wantShow upgrade expedites to local in 800ms.
  const PREFETCH_REMOTE_MS = 12000;
  const LOCAL_READY_MS = 1200;   // local file should be near-instant
  // analog grain via an SVG turbulence tile, jittered by steps() animation
  const NOISE_URI = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"220\" height=\"220\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\"/></filter><rect width=\"220\" height=\"220\" filter=\"url(%23n)\" opacity=\"0.55\"/></svg>')";

  let catalog = new Map();       // name -> {name,item,file,in,out,tags,credit,local}
  let tagIndex = new Map();      // genre tag -> [clip names] (from catalog tags)
  let names = [];                // playable clip names (idle bag domain)
  let base = "https://archive.org/download";
  let localAvail = new Set();    // clip names that have a local cache file (found/video/<name>.mp4)
  let online = true;

  let wrap = null, vbox = null, tear = null, vids = [], front = 0, scan = null;
  let osd = null, osdTimer = 0, glitchTimer = 0, idleTimer = 0, on = false, ready = false;   // on: DARK until the background program asks (controller-owned)
  let grain = null, dispEl = null, roEl = null, gbEl = null;   // SVG glitch knobs
  let curName = null, seq = 0, curGenre = "", profile = null;
  // ---- ALIEN BROADCAST chaos-layer state (event-driven station personality) --
  let fxlayer = null, pipEl = null, barsEl = null, cardEl = null, subEl = null,
      chanEl = null, tsEl = null, trackEl = null,
      stormDisp = null, stormTurb = null;
  let glyphEls = [], glyphRR = 0;         // roaming-glyph pool (no DOM churn) + round-robin cursor
  let scanBand = null, scanLines = null;  // analog vertical-blanking bar + near-subliminal fine texture
  let chaosTimer = 0, chaosOn = false, lastEvt = "", storm = 1, curFam = "vhs", lastSection = null;
  let evInfo = "";   // a sample transform/filter string an event may set for the gate log (see runNamed/_chaosLog)
  let barsTimer = 0, cardTimer = 0, subTimer = 0, pipTimer = 0, tsTimer = 0, fxTimer = 0, tsIv = 0, stormIv = 0;
  const chaosLog = [];   // {type,t,dur} ring — the gate harness reads VideoLayer._chaosLog()
  let catBag = [];               // shuffled bag over the whole catalog (idle/ambient)
  const reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fisher-Yates. Math.random is intentional: live presentation, not a render.
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function nextCatalog() {
    if (!names.length) return null;
    if (!catBag.length) { catBag = names.slice(); shuffle(catBag); }
    let n = catBag.pop();
    if (n === curName && catBag.length) { const m = catBag.pop(); catBag.unshift(n); n = m; }
    return n;
  }

  // reusable no-repeat shuffle bag over a CALLER-SUPPLIED pool (the explorer's
  // genre-affine clip pool changes as the mix travels). Unchanged mechanism —
  // shared so the layer + explorer don't drift. reset() clears it per session.
  function makeBag() {
    let bag = [], key = null, last = null;
    return {
      reset() { bag = []; key = null; last = null; },
      draw(pool) {
        if (!pool || !pool.length) return null;
        const k = pool.join(",");
        if (k !== key) { key = k; bag = shuffle(pool.slice()); }
        if (!bag.length) bag = shuffle(pool.slice());
        if (bag.length > 1 && bag[0] === last) bag.push(bag.shift());
        const c = bag.shift(); last = c;
        return c;
      },
    };
  }

  // ---------- genre-affine effect profiles (CSS look + glitch tier) ----------
  // Five families; every genre maps to one (default vhs — the house style).
  // filter = the base grade (CSS); glitch = burst intensity 0..1; tear = base
  // ms between tape wobbles; grain = analog-grain opacity; svg = attach the
  // RGB-split displacement filter (glitch family, desktop only — the one place
  // that wants real displacement). mfilter = the cheap phone grade.
  // chaos = ALIEN BROADCAST event intensity 0..1 (scales both how OFTEN the
  // chaos scheduler fires and how HARD each event hits); wgap = base mean ms
  // between chaos events at WACKADOODLE=1 (glitch = frenetic, clean/ambient =
  // sparse but deeply weird when it does fire). See the chaos layer below.
  const FAMILIES = {
    neon:   { filter: "saturate(2.05) contrast(1.34) brightness(.83) hue-rotate(-12deg) blur(.4px)",
              mfilter: "saturate(1.7) contrast(1.2)", glitch: .5, tear: 5200, grain: .10, svg: false, chaos: .55, wgap: 4200 },
    vhs:    { filter: "saturate(1.85) contrast(1.22) brightness(.9) sepia(.12) hue-rotate(-4deg) blur(.45px)",
              mfilter: "saturate(1.5) contrast(1.15)", glitch: .3, tear: 6500, grain: .13, svg: false, chaos: .42, wgap: 5200 },
    dusty:  { filter: "saturate(.72) contrast(.96) brightness(.92) sepia(.3) blur(.5px)",
              mfilter: "saturate(.8) sepia(.25)", glitch: .18, tear: 9000, grain: .2, svg: false, chaos: .34, wgap: 6600 },
    glitch: { filter: "saturate(1.75) contrast(1.46) brightness(.85) hue-rotate(4deg)",
              mfilter: "saturate(1.6) contrast(1.35)", glitch: .95, tear: 2600, grain: .16, svg: true, chaos: 1.0, wgap: 2100 },
    clean:  { filter: "saturate(1.22) contrast(1.08) brightness(.95)",
              mfilter: "saturate(1.15)", glitch: .08, tear: 12000, grain: .06, svg: false, chaos: .18, wgap: 11000 },
  };
  const GENRE_FAMILY = {};
  const fam = (list, f) => list.forEach(g => GENRE_FAMILY[g] = f);
  fam(["synthwave","italo","disco","dancepop","edm","trance","house","techno","psytrance",
       "electro","acidhouse","miamibass","newjack","deephouse","garage","chiptune","hogcore",
       "hi-nrg","eurobeat"], "neon");
  fam(["vaporwave","mallsoft","citypop","shibuyakei","bossanova","exotica","surfrock",
       "spacelounge","arabpop","chinawave","sovietwave","canawave","dinosynth","prelude"], "vhs");
  fam(["lofi","triphop","blues","jazz","tango","spokenword","dub","phonk","afrobeat",
       "desertblues","krautrock","coldwave","minimal","transitwave","bigbeat"], "dusty");
  fam(["idm","breakcore","industrial","industrialmetal","ebm","witchhouse","sludgemetal",
       "doomdrone","jungle","gabber","dubstep","darksynth"], "glitch");
  fam(["ambient","downtempo","neoclassical","wintersynth","newage"], "clean");
  function profileFor(g) { return FAMILIES[GENRE_FAMILY[g]] || FAMILIES.vhs; }

  function makeDom() {
    wrap = document.createElement("div");
    wrap.id = "vidlayer";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none";
    vbox = document.createElement("div");
    vbox.style.cssText = "position:absolute;inset:0;transition:filter " + (850 * SLOTH) + "ms ease,transform " + (850 * SLOTH) + "ms ease";   // genre-grade / travel easing, SLOTH'd
    // Two <video>s on EVERY tier, incl. mobile: one plays, one is the hidden
    // LOADER that buffers the next clip through the whole 8-measure window. On
    // mobile the loader is never composited (opacity 0) and is PAUSED the moment
    // it reaches canplay (see nextCand) — so it's a pure buffer, not a second
    // rendered decoder. At switch time FADE_MS=0 makes it a hard cut, not a
    // touch-janking crossfade. This is what finally lets a phone connection
    // stream archive.org: the loader gets PREFETCH_REMOTE_MS, not the 3.8s cap.
    for (let i = 0; i < 2; i++) {
      const v = document.createElement("video");
      v.muted = true; v.loop = false; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      // ALWAYS very slowed down (Paul 2026-07-06). Setting playbackRate after
      // src= is a RACE: the load algorithm resets playbackRate to
      // defaultPlaybackRate when new media loads — so the DEFAULT is the
      // mechanism; the ratechange guard catches any other reset.
      v.defaultPlaybackRate = RATE; v.playbackRate = RATE;
      v.addEventListener("ratechange", () => { if (Math.abs(v.playbackRate - RATE) > 0.01) v.playbackRate = RATE; });
      v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
        "opacity:0;transition:opacity " + FADE_MS + "ms ease";
      vbox.appendChild(v); vids.push(v);
    }
    wrap.appendChild(vbox);
    // SVG defs: the RGB-split displacement glitch filter (glitch-family only).
    // feDisplacementMap wobble + red/blue channel offset; scale & dx are the
    // knobs a burst animates. At rest (scale 0, dx 0) it's near-identity.
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0";
    svg.innerHTML =
      '<filter id="vidrgb" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.0008 0.0016" numOctaves="1" seed="7" result="t"/>' +
        '<feDisplacementMap id="viddisp" in="SourceGraphic" in2="t" scale="0" xChannelSelector="R" yChannelSelector="G" result="disp"/>' +
        '<feColorMatrix in="disp" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
        '<feOffset id="vidro" in="r" dx="0" dy="0" result="ro"/>' +
        '<feColorMatrix in="disp" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>' +
        '<feOffset id="vidgb" in="gb" dx="0" dy="0" result="gbo"/>' +
        '<feBlend in="ro" in2="gbo" mode="screen"/>' +
      '</filter>' +
      // chaos-layer backdrop-filter refs: posterize blink + displacement storm.
      // Both consume the BACKDROP (the video) when named from fxlayer's
      // backdrop-filter, so they never mutate vbox and can't fight the tape loop.
      '<filter id="vlposter" color-interpolation-filters="sRGB">' +
        '<feComponentTransfer>' +
          '<feFuncR type="discrete" tableValues="0 .28 .55 .8 1"/>' +
          '<feFuncG type="discrete" tableValues="0 .28 .55 .8 1"/>' +
          '<feFuncB type="discrete" tableValues="0 .28 .55 .8 1"/>' +
        '</feComponentTransfer>' +
      '</filter>' +
      '<filter id="vlstorm" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">' +
        '<feTurbulence id="vlstormturb" type="turbulence" baseFrequency="0.02 0.05" numOctaves="2" seed="3" result="st"/>' +
        '<feDisplacementMap id="vlstormdisp" in="SourceGraphic" in2="st" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    wrap.appendChild(svg);
    dispEl = svg.querySelector("#viddisp"); roEl = svg.querySelector("#vidro"); gbEl = svg.querySelector("#vidgb");
    stormDisp = svg.querySelector("#vlstormdisp"); stormTurb = svg.querySelector("#vlstormturb");
    // fxlayer: a full-frame overlay right above the video whose backdrop-filter
    // grades/inverts/displaces ONLY the footage beneath it. Isolated compositor
    // surface — chaos filter events touch this, never vbox, so they never war
    // with the base grade or the tape-wobble loop.
    fxlayer = document.createElement("div");
    fxlayer.style.cssText = "position:absolute;inset:0;pointer-events:none;transition:backdrop-filter " + (120 * SLOTH) + "ms ease,-webkit-backdrop-filter " + (120 * SLOTH) + "ms ease";   // resting effect-grade easing, SLOTH'd
    wrap.appendChild(fxlayer);
    // (the readability VEIL — a dark gradient scrim so map text read over
    // footage — is GONE, Paul 2026-07-10: "make sure the video isn't darkened
    // any more". The star map never sits over the video now — three exclusive
    // views — so the footage plays at full brightness; scanlines + grain stay.)
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;display:none";
    // ANALOG VERTICAL-BLANKING BAR (Paul 2026-07-06: the old dense multi-line
    // repeating-gradient read as "too much and too obviously digital"). Now: ONE
    // soft, slow-rolling darker band — the classic hum / vertical-hold bar — over
    // a BARELY-perceptible fine-line texture. The digital grid is gone; the roll
    // is SLOTH-slow (a single languid sweep, ~14s), the lines are near-subliminal,
    // and the frame leans on the grain for its analog tooth. scanshift now nudges
    // this subtly (a slow density swell), never a flashing grid.
    scan = document.createElement("div");
    scan.className = "vl-scan";
    scan.style.cssText = "position:absolute;inset:0;overflow:hidden;opacity:.62;mix-blend-mode:overlay;transition:opacity " + (0.3 * SLOTH) + "s";
    scanLines = document.createElement("div");   // near-subliminal fine texture (a notch bolder + softer ramp — Paul 2026-07-06: thicker, not sharper)
    scanLines.className = "vl-scanlines";
    scanLines.style.cssText = "position:absolute;inset:0;opacity:.32;transition:opacity " + (0.3 * SLOTH) + "s;" +
      // SOFT ramp (not a hard 1px grid — the old digital complaint): each line is a
      // gradient shoulder over a wider 6px period, so it reads as analog tooth.
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,.42) 0px,rgba(0,0,0,.06) 2px,transparent 3px,transparent 6px)";
    // THICKER ANALOG HUM (Paul 2026-07-06: "thicker scanlines, do more twisted
    // things"). Was ONE soft rolling band; now 2-3 stacked soft bands of varying
    // WIDTH drifting at DIFFERENT speeds + phases — a bolder, higher-contrast,
    // still-fully-ANALOG vertical hum (soft gradients, no sharp grid). scanBand is
    // now a container; each child rolls on its own SLOTH-slow clock.
    scanBand = document.createElement("div");
    scanBand.className = "vl-scanband";
    scanBand.style.cssText = "position:absolute;inset:0;overflow:hidden";
    const HUM = [
      { h: 46, a1: .30, a2: .44, s: 1.6, d: 0 },     // primary thick band, high contrast
      { h: 22, a1: .22, a2: .36, s: 1.12, d: 3.5 },  // narrower, faster drift
      { h: 66, a1: .14, a2: .24, s: 2.4, d: 7 },     // wide soft wash, slowest
    ];
    for (const b of HUM) {
      const bd = document.createElement("div");
      bd.className = "vl-humband";
      bd.style.cssText = "position:absolute;left:0;right:0;top:0;height:" + b.h + "vh;will-change:transform;" +
        "background:linear-gradient(180deg,transparent,rgba(0,0,0," + b.a1 + ") 40%,rgba(0,0,0," + b.a2 + ") 50%,rgba(0,0,0," + b.a1 + ") 60%,transparent)" +
        (reduced ? "" : ";animation:vl-vblank " + (b.s * SLOTH) + "s linear infinite;animation-delay:-" + b.d + "s");
      scanBand.appendChild(bd);
    }
    scan.append(scanLines, scanBand);
    grain = document.createElement("div");
    if (MOBILE) grain.setAttribute("hidden", "");
    grain.style.cssText = "position:absolute;inset:-220px;opacity:.12;mix-blend-mode:screen;transition:opacity .8s;" +
      "background-image:" + NOISE_URI + ";animation:vhsgrain .42s steps(2) infinite";
    tear = document.createElement("div");
    tear.style.cssText = "position:absolute;left:-2%;right:-2%;height:16px;top:40%;opacity:0;" +
      "mix-blend-mode:screen;transition:opacity " + (0.06 * SLOTH) + "s;" +
      "background:linear-gradient(rgba(255,255,255,.22),rgba(140,255,255,.12) 60%,transparent)";
    osd = document.createElement("div");
    osd.style.cssText = "position:absolute;top:16px;left:22px;opacity:0;transition:opacity " + (0.25 * SLOTH) + "s;" +
      "font:26px 'VT323',ui-monospace,Menlo,monospace;color:rgba(235,255,240,.45);" +
      "letter-spacing:.06em;text-shadow:2px 2px 0 rgba(0,0,0,.35)";
    const st = document.createElement("style");
    // vertical-hold roll travels FARTHER under DRAMA; the overscan scale grows
    // with the shift so the reveal is always hidden (never-black-edges law).
    const vrShift = Math.min(15, 7 * DRAMA).toFixed(1);            // % of frame the roll drifts each way
    const vrScale = (1 + (parseFloat(vrShift) / 100) * 2.4).toFixed(3);   // overscan >= shift on both sides
    st.textContent = "@keyframes vhsgrain{0%{transform:translate(0,0)}25%{transform:translate(-70px,40px)}" +
      "50%{transform:translate(45px,-90px)}75%{transform:translate(-30px,-35px)}100%{transform:translate(60px,70px)}}" +
      // vertical-hold roll: scale(vrScale) overscan hides the reveal so the roll
      // never exposes black (the never-black law extends to never-black-edges).
      "@keyframes vl-roll{0%{transform:scale(" + vrScale + ") translateY(-" + vrShift + "%)}50%{transform:scale(" + vrScale + ") translateY(" + vrShift + "%)}100%{transform:scale(" + vrScale + ") translateY(-" + vrShift + "%)}}" +
      ".vl-roll{animation:vl-roll " + (0.52 * SLOTH) + "s linear 2}" +   // vertical-hold roll, SLOTH'd to a languid drift
      // the analog vertical-blanking hum roll — soft bands sweep top to bottom
      // (each appears, rolls through, clears, reappears), the way a real hum bar
      // drifts. -100vh..100vh so a band of ANY height (up to ~66vh) is fully
      // hidden off-screen at each end. Compositor-cheap transform, SLOTH-slow.
      "@keyframes vl-vblank{from{transform:translateY(-100vh)}to{transform:translateY(100vh)}}";
    // ---- ALIEN BROADCAST furniture (dedicated overlay els; opacity-toggled,
    // never touch vbox — all cheap compositor paints over the base grade) ----
    barsEl = document.createElement("div");   // SMPTE-ish color-bar interstitial — DIM (haunted, not a reference chart)
    barsEl.style.cssText = "position:absolute;inset:0;opacity:0;transition:opacity " + (0.09 * SLOTH) + "s;filter:brightness(.5) saturate(.72);background:linear-gradient(90deg," +
      "#c0c0c0 0 14.28%,#c0c000 0 28.57%,#00c0c0 0 42.85%,#00c000 0 57.14%,#c000c0 0 71.42%,#c00000 0 85.71%,#2030c0 0 100%)";
    cardEl = document.createElement("div");   // big centered interstitial card (glyph standby)
    cardEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;" +
      "transition:opacity " + (0.12 * SLOTH) + "s;background:rgba(6,6,16,.55);color:#eafff0;text-align:center;padding:0 6%;" +
      "font:700 clamp(20px,5vw,54px) 'VT323',ui-monospace,monospace;letter-spacing:.14em;text-shadow:0 0 12px rgba(120,255,200,.45)";
    subEl = document.createElement("div");    // wrong captions of the music
    subEl.style.cssText = "position:absolute;left:0;right:0;bottom:8%;text-align:center;opacity:0;transition:opacity " + (0.18 * SLOTH) + "s;" +
      "font:26px 'VT323',ui-monospace,monospace;color:#f4fff8;letter-spacing:.08em;text-shadow:2px 2px 0 rgba(0,0,0,.6);" +
      "background:linear-gradient(transparent,rgba(0,0,0,.35),transparent)";
    chanEl = document.createElement("div");   // channel-number OSD (wrong/alien/huge)
    chanEl.style.cssText = "position:absolute;top:14px;right:20px;opacity:0;font:30px 'VT323',ui-monospace,monospace;" +
      "color:rgba(255,240,170,.9);letter-spacing:.05em;text-shadow:0 0 8px rgba(255,200,80,.55)";
    // ROAMING GLYPHS (Paul 2026-07-06: idents should "appear all over the place
    // and move around, different sizes"). A small POOL of pre-made elements (no
    // DOM churn) — each glyph event teleports a free one to a RANDOM spot at a
    // RANDOM size (small ticker -> huge quarter-screen watermark), then lets it
    // SLOWLY DRIFT (SLOTH-scaled, weather-like) with gentle rotation/scale for its
    // life. Occasionally 2-3 fire at once (a swarm moment). They live inside vbox,
    // so they warp with the footage (STACK LAW). Cheap transforms -> mobile too.
    const GLYPH_POOL = MOBILE ? 3 : 10;   // desktop pool widened (Paul 2026-07-10: "glyph layer more active, bigger glyphs more often") so a dense swarm can stand on-screen at once without teleporting live idents
    glyphEls = [];
    for (let i = 0; i < GLYPH_POOL; i++) {
      const gEl = document.createElement("div");
      gEl.className = "vl-glyph";   // gate/debug hook: the roaming idents are queryable in the DOM
      gEl.style.cssText = "position:absolute;left:50%;top:50%;opacity:0;white-space:nowrap;line-height:1;" +
        "will-change:transform,opacity;transform:translate(-50%,-50%);" +
        "font-family:'VT323',ui-monospace,monospace;color:rgba(210,255,250,.72);text-shadow:0 0 14px rgba(120,255,255,.5)";
      glyphEls.push(gEl);
    }
    tsEl = document.createElement("div");     // timestamp OSD (backwards / base-13)
    tsEl.style.cssText = "position:absolute;bottom:84px;right:20px;opacity:0;transition:opacity " + (0.2 * SLOTH) + "s;" +   // above the explorer's corner buttons (chrome overlays this layer)
      "font:24px 'VT323',ui-monospace,monospace;color:rgba(255,210,220,.75);letter-spacing:.08em;text-shadow:2px 2px 0 rgba(0,0,0,.5)";
    trackEl = document.createElement("div");  // tracking-noise band sweeping the frame
    trackEl.style.cssText = "position:absolute;left:-4%;right:-4%;height:5.5%;top:-12%;opacity:0;mix-blend-mode:screen;filter:blur(.6px);" +
      "background:repeating-linear-gradient(0deg,rgba(255,255,255,.5) 0 2px,rgba(180,255,255,.15) 2px 4px,transparent 4px 7px)";
    // STACK LAW (2026-07-06): the broadcast furniture/text lives INSIDE vbox, so
    // it rides every manipulation with the footage — vbox transforms (roll/hsync/
    // zoom/mirror) displace the glyphs, the base grade + mobile chaos filters tint
    // them, and desktop's fxlayer backdrop-filter (which samples everything behind
    // it = vbox + furniture) chroma-lurches / inverts / ghosts the text along with
    // the picture. veil/scan/grain/tear/osd stay ABOVE fxlayer as untouched texture
    // + the corner ident. cardEl (standby) is appended last -> paints on top.
    vbox.append(trackEl, barsEl, ...glyphEls, chanEl, tsEl, subEl, cardEl);
    wrap.append(veil, scan, grain, tear, osd, st);
    if (!MOBILE) {   // PiP / channel-surf peek: one extra decoder, desktop only
      pipEl = document.createElement("video");
      pipEl.muted = true; pipEl.loop = true; pipEl.playsInline = true; pipEl.preload = "auto";
      pipEl.setAttribute("muted", ""); pipEl.setAttribute("playsinline", "");
      pipEl.defaultPlaybackRate = RATE;   // src= resets playbackRate to the default — same law as the main elements
      pipEl.addEventListener("ratechange", () => { if (Math.abs(pipEl.playbackRate - RATE) > 0.01) pipEl.playbackRate = RATE; });
      pipEl.style.cssText = "position:absolute;right:4.5%;bottom:6%;width:30%;height:30%;object-fit:cover;opacity:0;" +
        "transition:opacity " + (0.18 * SLOTH) + "s;border:2px solid rgba(210,255,235,.5);border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,.5)";
      wrap.appendChild(pipEl);
    }
    document.body.prepend(wrap);
    profile = profileFor("");   // default look
    applyLook(true);
  }

  // ---------- effect stack ----------
  function baseFilterStr() {
    if (!profile) return "none";
    const svg = profile.svg && !MOBILE && !reduced;
    return (svg ? "url(#vidrgb) " : "") + (MOBILE ? profile.mfilter : profile.filter);
  }
  function applyLook(immediate) {
    if (!vbox) return;
    if (immediate) vbox.style.transition = "none";
    vbox.style.filter = baseFilterStr();
    vbox.style.transform = "none";
    if (grain && !MOBILE) grain.style.opacity = String(profile ? profile.grain : .12);
    if (immediate) { void vbox.offsetWidth; vbox.style.transition = "filter " + (850 * SLOTH) + "ms ease,transform " + (850 * SLOTH) + "ms ease"; }
  }
  function setGenre(g) {
    if (!g || g === curGenre) return;
    curGenre = g; profile = profileFor(g); curFam = GENRE_FAMILY[g] || "vhs";
    applyLook(false);
    glitchLoop();   // reschedule tape wobbles at the new cadence
    if (chaosOn) restartChaos();   // pick up the new family's chaos cadence/intensity
  }

  function flashOsd(text) {
    if (!osd) return;
    osd.textContent = text;
    osd.style.opacity = "1";
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => { osd.style.opacity = "0"; }, 1900 * SLOTH);
  }

  // one tape wobble: color/blur glide out and back, tear band drifts. Intensity
  // scales with the genre profile; glitch-family bursts also kick the SVG
  // RGB-split displacement (idm/darksynth/breakcore tear hard; ambient barely).
  function burst() {
    if (!ready || !on || reduced || !vbox || !profile) return;   // mobile too: transform+filter wobble is compositor-cheap
    const g = profile.glitch;
    const dx = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 6) * (0.5 + g) * DRAMA;   // farther tape shove under DRAMA
    const dur = (900 + Math.random() * 700) * SLOTH;   // tape wobble glides out+back over dur (eased -> smooth); languid at SLOTH
    vbox.style.transition = "filter " + (dur / 2) + "ms ease-in-out, transform " + (dur / 2) + "ms ease-in-out";
    vbox.style.filter = baseFilterStr() + " saturate(" + (1.2 + g * DRAMA).toFixed(2) + ") hue-rotate(" + (((Math.random() * 50 - 25) * g * DRAMA) | 0) + "deg) blur(" + Math.min(2.6, 0.6 + g * DRAMA).toFixed(2) + "px)";
    vbox.style.transform = "translateX(" + dx.toFixed(1) + "px) scaleY(" + (1 + .02 * g * DRAMA).toFixed(3) + ")";
    if (profile.svg && dispEl && !MOBILE) {   // SVG RGB-split is desktop-only (not in the mobile base grade)
      const scale = (10 + Math.random() * 26) * g * DRAMA, off = (2 + Math.random() * 5) * g * DRAMA;
      dispEl.setAttribute("scale", scale.toFixed(1));
      if (roEl) roEl.setAttribute("dx", (-off).toFixed(1));
      if (gbEl) gbEl.setAttribute("dx", off.toFixed(1));
    }
    const top0 = 8 + Math.random() * 70;
    tear.style.transition = "opacity " + (dur / 2.2) + "ms ease-in-out, top " + dur + "ms linear";
    tear.style.top = top0 + "%";
    tear.style.opacity = String(.4 + .6 * g);
    requestAnimationFrame(() => { tear.style.top = (top0 + 12) + "%"; });
    setTimeout(() => {
      applyLook(false); tear.style.opacity = "0";
      if (dispEl) { dispEl.setAttribute("scale", "0"); if (roEl) roEl.setAttribute("dx", "0"); if (gbEl) gbEl.setAttribute("dx", "0"); }
    }, dur / 2);
  }
  function glitchLoop() {
    clearTimeout(glitchTimer);
    if (!ready || !on || reduced) return;
    const period = (profile ? profile.tear : 6000) * SLOTH;   // wobbles are ~10x longer now; space them ~10x too so they never stack
    glitchTimer = setTimeout(() => { burst(); glitchLoop(); }, period + Math.random() * period * 0.9);
  }

  // ======================================================================
  // ALIEN BROADCAST — the chaos layer. An 80s TV station run by slightly
  // insane alien AI intelligences. An event-driven personality riding ON TOP
  // of the five genre-family base grades (those are the BASE GRADE; this is the
  // chaos). A Poisson-ish scheduler (bursts and lulls, never a metronome) draws
  // from a weighted deck of ~20 momentary events, never the same one twice in a
  // row, frequency + intensity scaled by the genre family (glitch = frenetic,
  // ambient = sparse but deeply weird). Everything is CSS/SVG/DOM only, no
  // per-frame JS pixel work (archive.org taints WebGL; the audio load gate is
  // sacred): events set a style / one SVG attribute and schedule their own
  // revert. Math.random is fine — this is the presentational layer.
  //
  //   >>> THE WACKADOODLE DIAL <<<  one number to rule the whole station.
  //   1 = house insanity. Bump toward ~2 for a full alien meltdown, drop toward
  //   ~0.4 to sedate. It multiplies event RATE (and lightly the burst odds);
  //   per-event intensity rides the genre family's `chaos`.
  const WACKADOODLE = 1.0;
  // (SLOTH — the "transitions & effects 10x slower" dial, Paul 2026-07-06 — is
  //  the sibling of this knob; it lives at the top of the file next to FADE_MS
  //  because the crossfade constant needs it before this point.)

  const nowMs = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const expRand = () => -Math.log(1 - Math.random());   // mean 1, memoryless -> natural clustering
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  // NEVER-EXPOSE law for the rotation/lean events: the uniform scale needed so a
  // frame rotated by `deg` still fully covers the viewport (a same-aspect rect
  // rotated by θ needs s >= |cosθ| + AR·|sinθ|, AR = the longer/shorter side
  // ratio). Returns the MAX required scale over the whole sweep [0..|deg|] — the
  // requirement peaks near atan(AR) (~60° on 16:9, ~s=2.04), so holding this one
  // scale for the entire lean guarantees corners never open at any intermediate
  // angle. A small margin is applied at the call site.
  function leanCoverScale(deg) {
    const w = (root.innerWidth || 1280), h = (root.innerHeight || 720);
    const ar = Math.max(w / h, h / w);
    const need = (d) => { const r = Math.abs(d) * Math.PI / 180; return Math.abs(Math.cos(r)) + ar * Math.abs(Math.sin(r)); };
    const peak = Math.atan(ar) * 180 / Math.PI;   // angle of maximum required scale
    const a = Math.abs(deg);
    return Math.max(1, need(a), a >= peak ? need(peak) : 0);
  }
  function clog(type, dur, info) {
    chaosLog.push({ type, t: Math.round(nowMs()), dur: Math.round(dur), info: info || "" });
    if (chaosLog.length > 600) chaosLog.shift();
  }
  function chaosIntensity() { return profile && profile.chaos != null ? profile.chaos : 0.4; }

  // fxlayer backdrop-filter helpers — grade/invert/displace the footage.
  // DESKTOP: write backdrop-filter on the isolated fxlayer surface (samples the
  //   video beneath it; no war with vbox's base grade / tape-wobble loop).
  // MOBILE: backdrop-filter is a perf/support risk on mobile Safari, so we COMPOSE
  //   the same look directly onto vbox's own filter (base grade string + event) —
  //   identical result, no second compositor surface. Because the furniture now
  //   lives inside vbox, this filters the glyphs too. Reverts to the base grade.
  function fxSet(css) {
    if (MOBILE) { if (vbox) vbox.style.filter = baseFilterStr() + " " + css; return; }
    if (!fxlayer) return; fxlayer.style.webkitBackdropFilter = css; fxlayer.style.backdropFilter = css;
  }
  function fxClear() {
    if (MOBILE) { if (vbox) vbox.style.filter = baseFilterStr(); return; }
    if (!fxlayer) return; fxlayer.style.backdropFilter = ""; fxlayer.style.webkitBackdropFilter = "";
  }
  function fxTrans(t) {
    if (MOBILE) { if (vbox) vbox.style.transition = (!t || t === "none") ? "none" : t.replace(/-?webkit-?backdrop-filter/gi, "filter").replace(/backdrop-filter/gi, "filter"); return; }
    if (fxlayer) fxlayer.style.transition = t;
  }
  // flicker an OSD element (channel / glyph): random on/off/dim, then hide.
  function flickerEl(el, dur, peak) {
    if (!el) return;
    const hi = peak == null ? 1 : peak;   // GLYPHs pass a size-scaled peak: huge watermarks stay faint, small idents burn bright
    el.style.opacity = hi.toFixed(2);
    const end = nowMs() + dur;
    const blink = () => {
      if (nowMs() >= end) { el.style.opacity = "0"; return; }
      el.style.opacity = (hi * (Math.random() < .22 ? .16 : (Math.random() < .5 ? 1 : .72))).toFixed(2);
      setTimeout(blink, (55 + Math.random() * 150) * SLOTH);   // lazy flicker, not a fast twitch (dur is SLOTH'd at call sites too)
    };
    setTimeout(blink, 50 * SLOTH);
  }
  // pick the next pooled glyph (round-robin — chaos events are serialized, so a
  // full cycle of the pool outlives any one glyph's life; a swarm of <=3 lands on
  // distinct elements). Returns an element ready to be teleported + drifted.
  function freeGlyph() {
    if (!glyphEls.length) return null;
    const el = glyphEls[glyphRR % glyphEls.length]; glyphRR++;
    return el;
  }
  // spawn ONE roaming glyph: random position anywhere (size-aware inset so it
  // never clips), random size (small ticker -> huge quarter-screen watermark),
  // then a SLOW weather-like drift (direction/speed randomized, SLOTH-scaled)
  // with gentle rotation + slow scale breathing on some. Returns its life in ms.
  function spawnGlyph() {
    const el = freeGlyph(); if (!el) return 400;
    el.textContent = pick(GLYPHS);
    const size = rnd(4.5, 34);                       // vmin: bigger ticker .. huge half-screen watermark (Paul 2026-07-10: "bigger glyphs")
    el.style.fontSize = size.toFixed(1) + "vmin";
    const inset = Math.min(40, 5 + size * 1.35);     // % — bigger glyph, bigger safe margin
    const x0 = rnd(inset, 100 - inset), y0 = rnd(inset, 100 - inset);
    const rot0 = rnd(-7, 7);
    el.style.transition = "none";                    // teleport instantly...
    el.style.left = x0.toFixed(1) + "%"; el.style.top = y0.toFixed(1) + "%";
    el.style.transform = "translate(-50%,-50%) rotate(" + rot0.toFixed(1) + "deg)";
    el.style.opacity = "0";                          // ...born invisible: glyphs FADE in and out (Paul 2026-07-06)
    void el.offsetWidth;                             // ...commit before arming the drift transition
    const dur = (360 + Math.random() * 900) * SLOTH; // ~3.6s .. 12.6s of life
    const ang = Math.random() * Math.PI * 2, dist = rnd(4, 13);   // vmin traversed over the WHOLE life -> dust-mote slow
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    const rot1 = rot0 + (Math.random() < .5 ? -1 : 1) * rnd(2, 12);         // gentle rotation on some
    const breath = Math.random() < .5 ? rnd(1.05, 1.2) : rnd(.86, .98);     // slow scale breathing on some
    // an opacity ease rides alongside the drift: every flicker step becomes a
    // slow glow-swell instead of a snap, the entry is a fade-in from 0, and
    // flickerEl's terminal opacity=0 becomes a real fade-out at end of life.
    const fadeMs = Math.round(Math.min(dur * 0.3, 3200));
    el.style.transition = "transform " + Math.round(dur) + "ms linear, opacity " + fadeMs + "ms ease";
    requestAnimationFrame(() => {
      el.style.transform = "translate(calc(-50% + " + dx.toFixed(1) + "vmin),calc(-50% + " + dy.toFixed(1) + "vmin)) " +
        "rotate(" + rot1.toFixed(1) + "deg) scale(" + breath.toFixed(3) + ")";
    });
    const peak = Math.max(.4, .95 - (size - 4.5) / (34 - 4.5) * .5);   // huge watermarks faint, small idents bright (range tracks the widened size band)
    flickerEl(el, dur, peak);
    return dur;
  }
  // an alt clip for PiP / channel-surf: prefer a LOCAL cache clip (snappy hard
  // cut), else any other playable name (remote may pop in late — chaos-tolerant).
  function pickAlt() {
    const loc = [...localAvail].filter(n => n !== curName);
    if (loc.length) return pick(loc);
    const rem = names.filter(n => n !== curName);
    return rem.length ? pick(rem) : null;
  }
  function srcFor(name) {
    const c = candidates(name)[0];
    if (!c) return null;
    const frag = c.kind === "remote" && c.in ? ("#t=" + c.in) : "";
    return c.url + frag;
  }
  function setPip(v, src, full) {
    if (!v) return;
    try { if (v.getAttribute("src") !== src) { v.src = src; v.load(); } } catch (e) {}
    v.playbackRate = RATE;
    if (full) {   // channel-surf HARD CUT: cover the frame (front keeps playing beneath -> no gap)
      v.style.left = "0"; v.style.top = "0"; v.style.right = "0"; v.style.bottom = "0";
      v.style.width = "100%"; v.style.height = "100%"; v.style.borderRadius = "0"; v.style.border = "none";
    } else {      // corner picture-in-picture
      v.style.left = "auto"; v.style.top = "auto"; v.style.right = "4.5%"; v.style.bottom = "6%";
      v.style.width = "30%"; v.style.height = "30%"; v.style.borderRadius = "6px";
      v.style.border = "2px solid rgba(210,255,235,.5)";
    }
    // reveal only once frames exist — an empty bordered box is a broken TV,
    // not an insane one. If the clip never readies, the event just no-shows.
    if (v.readyState >= 2) v.style.opacity = "1";
    else v.oncanplay = () => { v.oncanplay = null; v.style.opacity = "1"; };
    v.play().catch(() => {});
  }
  function hidePip() {
    if (!pipEl) return;
    pipEl.oncanplay = null;
    pipEl.style.opacity = "0";
    setTimeout(() => { try { pipEl.pause(); } catch (e) {} }, 420);
  }

  // ---- the station's dictionary ----
  // station idents: alien-looking but drawn from blocks widely covered by
  // default font stacks (box drawing, braille, trigrams, runic, math) — exotic
  // planes (cuneiform, alchemical) tofu'd on the verification runs.
  // NO ENGLISH anywhere on the broadcast (2026-07-06): the station speaks pure
  // glyph, drawn ONLY from blocks that render in default font stacks (box-drawing,
  // block elements, braille, geometric shapes, trigrams, runic, math operators) —
  // exotic planes (cuneiform, alchemical, Glagolitic) tofu'd on the verify runs
  // and are banned. Structure is preserved (a caption still reads as a caption, a
  // card as a card, a channel marker as a channel number) — only the language is
  // alien. GLYPHS = fleeting station idents. E̸R̷R̸ combining-strike kept (ASCII
  // under alien decoration, reads as "corrupted", not as a word).
  const GLYPHS = ["╬╪▚▞", "⠺⠵⣿⠋", "▟▙◈▛", "◭◮⊗⊘", "⋔⋕⊞⊟", "↯⇶↯↺", "ᛝᚦᛟᚱ", "▓▚E̸R̷R̸▞░", "☰☲☵☷", "◇⬡◇⬢", "∴∵∷⁂", "⌁⌇⌭⌗"];
  // SUBS = wrong captions of the music — bracketed, caption-shaped, alien content.
  const SUBS = ["[⠺⠵⣿⠋ ╬╪▚▞]", "[◈ ⊞⊟⊗⊘ ◈]", "[☰☲ ᛝᚦᛟ ☵☷]",
    "[▓▚ ⡇⢸⣿ ▞░]", "[△ ∴∵∷ ◊ ⁂ △]", "[⋔⋕ ◭◮ ⇶↯↺]",
    "[⌁⌇⌭ ⠿⡇⢸ ⌗]", "[◇⬡◇ ▟▙◈▛ ⬢◇]", "[ᚠᚢᛗ ▚▞ ᛚᚱ]",
    "[☷☵ ⊕⊙ ∷∵ ☲☰]", "[◊ ⣿⠋⠺⠵ ◊]", "[▛▜ ╬╪ ▙▟]",
    "[↯⇶↯ ⊘⊗ ↺⇌]", "[⠿⣿ ▓▒░ ⡇⢸]"];
  // CHAN = channel-number OSD — alien marker glyph + (universal) numerals, so it
  // still FEELS like a channel number without an English word.
  const CHAN = ["⊟ 03", "╪ 88", "▚ 7½", "◈ ∞", "⊗ -12", "⌗ 0x1F", "☲ 13",
    "▓ 999", "⊘ ■■", "◭ 00", "╬ 24", "⁂ 404"];
  // STANDBY = the big centered interstitial card — a broadcast card in glyphs.
  const STANDBY = ["◈ ╬╪▚▞ ◈", "▓▒░ ⊗⊘ ░▒▓", "△ ⠺⠵⣿⠋ △", "☰☲☵☷",
    "⋔⋕ ⊞⊟ ⋔⋕", "◭◮ ⇶↯↺ ◮◭", "⌁⌇⌭⌗", "▟▙◈▛ ⬡ ▜◈▙▟"];
  // base-13 clock, wrong on purpose
  function fmtTS(v) {
    const d = "0123456789ABC"; v = ((v % 28561) + 28561) % 28561;
    const g = (x) => d[(((x | 0) % 13) + 13) % 13];
    return "△ " + g(v / 2197) + g(v / 169) + ":" + g(v / 13) + g(v) + ":" + g(v * 7) + g(v * 3);
  }

  // ---- the event deck. name -> {w: base weight, mobile: cheap enough for phones,
  // can(): availability predicate, run(): apply + self-revert, RETURN nominal ms
  // duration}. The scheduler serializes events (next fires after dur + gap), so
  // vbox-mutating events don't overlap each other; filter events live on fxlayer.
  const EV = {
    // -- analog decay --
    vroll: { w: 6, mobile: true, run() {   // vertical-hold roll — CSS keyframe (smooth); SLOTH makes it a languid drift (animation duration is SLOTH'd in the keyframe rule, so dur matches at 1040*SLOTH)
        vbox.style.transition = "none"; vbox.classList.add("vl-roll");
        const dur = 1040 * SLOTH; setTimeout(() => { vbox.classList.remove("vl-roll"); applyLook(false); }, dur); return dur; } },
    hsync: { w: 7, mobile: true, run() {   // h-sync tear: skew wander. Literal x10 on the step count would be a slide-show of held skews, so instead we SLEW — each skew now GLIDES over its longer step (transition = dt, was a 28ms snap-and-hold) -> continuous slow sync-drift
        const g = chaosIntensity(), n = 3 + ((Math.random() * 4) | 0), dt = (42 + Math.random() * 44) * SLOTH;
        vbox.style.transition = "transform " + Math.round(dt) + "ms linear";
        for (let i = 0; i < n; i++) setTimeout(() => {
          const sk = (Math.random() * 26 - 13) * (0.5 + g);
          vbox.style.transform = "skewX(" + sk.toFixed(1) + "deg) translateX(" + (sk | 0) + "px) scale(1.06)";
        }, i * dt);
        const dur = n * dt + 40; setTimeout(() => applyLook(false), dur); return dur; } },
    tracking: { w: 6, mobile: true, run() {   // tracking-noise band sweeps the frame (linear transition -> already smooth; just ~10x longer)
        const dur = (480 + Math.random() * 720) * SLOTH;
        trackEl.style.transition = "none"; trackEl.style.top = "-12%"; trackEl.style.opacity = ".85";
        void trackEl.offsetWidth;
        trackEl.style.transition = "top " + dur + "ms linear, opacity " + dur + "ms ease-in";
        trackEl.style.top = "108%"; setTimeout(() => { trackEl.style.opacity = "0"; }, dur * 0.95);
        return dur; } },
    chroma: { w: 7, mobile: true, run() {   // chroma drift: hue-rotate lurch — eased backdrop-filter, smooth slow at SLOTH; DRAMA deepens the lurch
        const g = chaosIntensity(), dur = (280 + Math.random() * 540) * SLOTH;
        const deg = ((60 + Math.random() * 220) * (0.5 + g) * DRAMA) * (Math.random() < .5 ? -1 : 1);
        fxTrans("backdrop-filter " + (dur * .4) + "ms ease,-webkit-backdrop-filter " + (dur * .4) + "ms ease");
        evInfo = "hue-rotate(" + (deg | 0) + "deg) saturate(" + (1.4 + g * DRAMA).toFixed(2) + ")";
        fxSet(evInfo);
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, dur); return dur; } },
    ghost: { w: 5, mobile: false, run() {   // ghosting: offset RGB drop-shadow doubles (fxlayer) — held ~10x longer, a ghost that lingers; DRAMA pulls the copies farther apart
        const g = chaosIntensity(), off = ((4 + Math.random() * 11) * (0.6 + g) * DRAMA) | 0, dur = (340 + Math.random() * 720) * SLOTH;
        fxTrans("none");
        evInfo = "drop-shadow(" + off + "px 0 0 rgba(255,60,90,.5)) drop-shadow(" + (-off) + "px 0 0 rgba(60,180,255,.5)) blur(.3px)";
        fxSet(evInfo);
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, dur); return dur; } },
    pump: { w: 5, mobile: true, run() {   // brightness BREATHING — SLOTH stretches each step (eased -> smooth slow throb); DRAMA pushes each level FARTHER from 1 (deeper pumps), clamped so the frame never blacks/blows out
        const g = chaosIntensity(), dt = 105 * SLOTH;
        const push = (v) => Math.max(0.16, Math.min(2.4, 1 + (v - 1) * DRAMA));
        const seq = [1.6 + g, 0.55, 1.4 + g * .5, 0.8, 1].map(push);
        fxTrans("backdrop-filter " + Math.round(dt) + "ms ease-in-out,-webkit-backdrop-filter " + Math.round(dt) + "ms ease-in-out");
        evInfo = "brightness(" + seq[0].toFixed(2) + "..) contrast(" + (1 + .3 * g * DRAMA).toFixed(2) + ")";
        seq.forEach((b, i) => setTimeout(() => fxSet("brightness(" + b.toFixed(2) + ") contrast(" + (1 + .3 * g * DRAMA).toFixed(2) + ")"), i * dt));
        const dur = seq.length * dt + 40; setTimeout(fxClear, dur); return dur; } },
    invert: { w: 4, mobile: true, run() {   // invert WASH: SLOTH turns the old fast blink into ONE slow fade to negative and back (invert() is numeric, so CSS eases it smoothly) — "a 300ms blink becomes a slow wash"
        const n = 2 + ((Math.random() * 3) | 0), dt = 66 + Math.random() * 60, dur = n * 2 * dt * SLOTH;
        fxTrans("backdrop-filter " + Math.round(dur * .4) + "ms ease-in-out,-webkit-backdrop-filter " + Math.round(dur * .4) + "ms ease-in-out");
        fxSet("invert(1) hue-rotate(180deg)");
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, Math.round(dur * .55));
        return dur; } },
    posterize: { w: 4, mobile: true, run() {   // posterize flashes. url() SVG filters CANNOT CSS-interpolate, so no smooth wash is possible here — keep discrete flashes but SLOTH each hold: 1-2 slow deliberate posterizations (long enough to read as intentional, too few to be a slide-show)
        const n = 1 + ((Math.random() * 2) | 0), dt = (120 + Math.random() * 150) * SLOTH; fxTrans("none");
        for (let i = 0; i < n; i++) { setTimeout(() => fxSet("url(#vlposter) saturate(1.5)"), i * 2 * dt); setTimeout(fxClear, (i * 2 + 1) * dt); }
        return n * 2 * dt; } },
    scanshift: { w: 5, mobile: true, run() {   // a SLOW swell of the analog bar/texture — NOT a digital grid flash. Eased over the (SLOTH'd) scan transition: the whole scanline layer densifies + the fine texture surfaces a touch, then settles.
        const dur = (380 + Math.random() * 700) * SLOTH;
        scan.style.opacity = (0.7 + Math.random() * 0.25).toFixed(2);
        if (scanLines) scanLines.style.opacity = (0.4 + Math.random() * 0.3).toFixed(2);
        setTimeout(() => { scan.style.opacity = ".55"; if (scanLines) scanLines.style.opacity = ".26"; }, dur); return dur; } },
    // -- broadcast furniture --
    colorbars: { w: 1, mobile: true, run() {   // SMPTE-ish interstitial — RARE, DIM. Full-frame furniture, so SLOTH the hold but CAP at 8s (like the standby card) so it never squats the whole screen for a minute
        const long = Math.random() < .05, dur = Math.min((long ? rnd(1300, 2200) : rnd(150, 420)) * SLOTH, 8000);
        barsEl.style.opacity = long ? "0.6" : "0.66";   // wash, not a full-brightness reference chart
        clearTimeout(barsTimer); barsTimer = setTimeout(() => { barsEl.style.opacity = "0"; }, dur); return dur; } },
    standby: { w: 2, mobile: true, run() {   // glyph interstitial card. SLOTH the hold but CAP at 8s — a full-screen card must never squat the whole view for a minute
        cardEl.textContent = pick(STANDBY);
        const long = Math.random() < .18, dur = Math.min((long ? rnd(3000, 5000) : rnd(600, 1500)) * SLOTH, 8000);
        cardEl.style.opacity = "1";
        clearTimeout(cardTimer); cardTimer = setTimeout(() => { cardEl.style.opacity = "0"; }, dur); return dur; } },
    channelosd: { w: 6, mobile: true, run() {   // channel number OSD, lazily flickering (flickerEl cadence is SLOTH'd too)
        chanEl.textContent = pick(CHAN); const dur = (500 + Math.random() * 1500) * SLOTH; flickerEl(chanEl, dur); return dur; } },
    timestamp: { w: 4, mobile: true, run() {   // backwards / base-13 clock OSD — held ~10x longer and ticking lazily (120 -> 1200ms) so the clock crawls
        const dur = (900 + Math.random() * 1700) * SLOTH, back = Math.random() < .6; let v = (Math.random() * 20000) | 0;
        tsEl.style.opacity = ".8"; clearInterval(tsIv);
        tsIv = setInterval(() => { v += back ? -7 : 11; tsEl.textContent = fmtTS(v); }, 120 * SLOTH);
        clearTimeout(tsTimer); tsTimer = setTimeout(() => { clearInterval(tsIv); tsEl.style.opacity = "0"; }, dur); return dur; } },
    // -- alien intelligence --
    glyph: { w: 14, mobile: true, run() {   // roaming station idents — now the LOUDEST voice in the deck (Paul 2026-07-10: "more active, bigger, more often"). Frequent, often a 3-5 swarm; each spawns anywhere, sized wildly, drifting slowly.
        const swarm = Math.random() < .45 ? 3 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < swarm; i++) spawnGlyph();
        // return a SHORT scheduling gap, not the glyph's (long, SLOTH-scaled) life:
        // each glyph self-manages its own fade via flickerEl + its transition, so the
        // deck can move on and keep layering fresh idents while these still drift.
        return 650 + Math.random() * 700; } },
    subtitle: { w: 6, mobile: true, run() {   // wrong captions — held ~10x longer (bottom band, non-blocking, so uncapped: a caption that lingers like a dream)
        subEl.textContent = pick(SUBS); const dur = (1200 + Math.random() * 1900) * SLOTH;
        subEl.style.opacity = "1"; clearTimeout(subTimer); subTimer = setTimeout(() => { subEl.style.opacity = "0"; }, dur); return dur; } },
    pip: { w: 4, mobile: false, can() { return !!pipEl && !!pickAlt(); }, run() {   // picture-in-picture of ANOTHER clip — lingers ~10x (corner, non-blocking)
        const n = pickAlt(), src = n && srcFor(n); if (!src) return 300; setPip(pipEl, src, false);
        const dur = (1400 + Math.random() * 2600) * SLOTH; clearTimeout(pipTimer); pipTimer = setTimeout(hidePip, dur); return dur; } },
    zoom: { w: 6, mobile: true, run() {   // zoom BREATH: SLOTH both the ease-in and the drift-back so it swells in and out like weather; DRAMA widens the swell (up to ~3.5x) and sometimes a slight slow lean rides along
        const sc = Math.min(3.5, 1.7 + Math.random() * 1.1 * DRAMA), dur = (700 + Math.random() * 900) * SLOTH, into = 60 * SLOTH;
        const rot = Math.random() < .5 ? (Math.random() < .5 ? -1 : 1) * rnd(3, 9) : 0;   // scale >=1.7 more than covers a <=9deg lean -> corners stay filled
        const tf = "scale(" + sc.toFixed(2) + ") rotate(" + rot.toFixed(1) + "deg)"; evInfo = tf;
        vbox.style.transition = "transform " + into + "ms ease-out"; vbox.style.transform = tf;
        setTimeout(() => { vbox.style.transition = "transform " + dur + "ms cubic-bezier(.2,.7,.2,1)"; vbox.style.transform = "none"; }, into + 10);
        setTimeout(() => applyLook(false), into + dur + 80); return into + dur; } },
    mirror: { w: 5, mobile: true, run() {   // mirror / flip — the flip itself is discrete (a reflection can't tween), but HOLD it ~10x so the frame sits mirrored like a held breath
        const flip = Math.random() < .5 ? "scaleX(-1)" : "scaleY(-1)", dur = (120 + Math.random() * 520) * SLOTH;
        vbox.style.transition = "none"; vbox.style.transform = flip + " scale(1.02)";
        setTimeout(() => applyLook(false), dur); return dur; } },
    dispstorm: { w: 5, mobile: false, run() {   // feTurbulence displacement storm. SLOTH stretches the DURATION (a storm that rolls in like weather); reseed INTERVAL stays 90ms (smooth churn). DRAMA drives it harder but a CAP keeps the smear watchable — footage stays the subject
        const g = chaosIntensity(), dur = (700 + Math.random() * 1200) * SLOTH; fxTrans("none"); fxSet("url(#vlstorm) contrast(1.08)");
        const end = nowMs() + dur; clearInterval(stormIv);
        const peak = Math.min(175, (110) * (0.5 + g) * (0.6 + 0.4 * DRAMA)); evInfo = "url(#vlstorm) scale<=" + (peak | 0);
        stormIv = setInterval(() => {
          if (nowMs() >= end) { clearInterval(stormIv); fxClear(); if (stormDisp) stormDisp.setAttribute("scale", "0"); return; }
          if (stormDisp) stormDisp.setAttribute("scale", Math.min(175, ((20 + Math.random() * 90) * (0.5 + g) * (0.6 + 0.4 * DRAMA)) | 0).toFixed(0));
          if (stormTurb) stormTurb.setAttribute("seed", String((Math.random() * 9999) | 0));
        }, 90); return dur; } },
    // -- DEEP BROADCAST slow organic warps (Paul 2026-07-06: "rotate more, do
    //    more twisted things"). All CSS transform/filter, compositor-cheap. Each
    //    holds a cover-scale so a rotated/sheared frame never opens an edge —
    //    the footage stays the subject even mid-lean. mobile:true = pure
    //    transform (phone-safe); the blur/drop-shadow-heavy ones stay desktop. --
    lean: { w: 4, mobile: true, run() {   // THE MARQUEE MOVE: the whole frame slowly LEANS 25-90deg and back over a long life; a single cover-scale is held for the ENTIRE sweep so corners never expose at any intermediate angle (geological)
        const dir = Math.random() < .5 ? -1 : 1;
        const theta = Math.min(90, rnd(28, 66) * (0.65 + 0.45 * DRAMA)) * dir;
        const S = leanCoverScale(theta) * 1.05;
        const warm = 90 * SLOTH, outMs = (620 + Math.random() * 420) * SLOTH, backMs = outMs * 1.1;
        evInfo = "rotate(" + theta.toFixed(1) + "deg) scale(" + S.toFixed(3) + ")";
        vbox.style.transition = "transform " + Math.round(warm) + "ms ease-in-out";
        vbox.style.transform = "rotate(0deg) scale(" + S.toFixed(3) + ")";   // scale up first (rotation still 0 -> nothing exposed while it grows)
        setTimeout(() => { vbox.style.transition = "transform " + Math.round(outMs) + "ms cubic-bezier(.4,0,.3,1)"; vbox.style.transform = "rotate(" + theta.toFixed(1) + "deg) scale(" + S.toFixed(3) + ")"; }, warm + 10);
        setTimeout(() => { vbox.style.transition = "transform " + Math.round(backMs) + "ms cubic-bezier(.4,0,.3,1)"; vbox.style.transform = "rotate(0deg) scale(" + S.toFixed(3) + ")"; }, warm + outMs + 20);
        setTimeout(() => { vbox.style.transition = "transform " + Math.round(warm) + "ms ease-in-out"; applyLook(false); }, warm + outMs + backMs + 30);
        return warm + outMs + backMs + warm + 60; } },
    persplean: { w: 3, mobile: true, run() {   // PERSPECTIVE TILT — the picture leans away in 3D like it's falling asleep (rotate3d/rotateX|Y). Modest angle + generous scale so the foreshortened far edge still covers. Pure transform -> mobile-safe
        const ax = Math.random() < .5, ang = (Math.random() < .5 ? -1 : 1) * Math.min(24, rnd(8, 16) * (0.7 + 0.3 * DRAMA));
        const sc = 1.34 + Math.abs(ang) / 50, dur = (680 + Math.random() * 520) * SLOTH, into = 120 * SLOTH;
        const tf = "perspective(1100px) rotate" + (ax ? "X" : "Y") + "(" + ang.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")"; evInfo = tf;
        vbox.style.transition = "transform " + Math.round(into) + "ms ease-out"; vbox.style.transform = tf;
        setTimeout(() => { vbox.style.transition = "transform " + Math.round(dur) + "ms cubic-bezier(.3,.6,.2,1)"; vbox.style.transform = "none"; }, into + 10);
        setTimeout(() => applyLook(false), into + dur + 60); return into + dur; } },
    sway: { w: 3, mobile: true, run() {   // PENDULUM SWAY — the frame rocks a few degrees each way, a couple of slow swings, held under a cover-scale so corners stay filled
        const amp = Math.min(9, rnd(3, 6) * (0.7 + 0.3 * DRAMA)), S = leanCoverScale(amp) * 1.06;
        const swings = 3 + ((Math.random() * 2) | 0), total = (600 + Math.random() * 400) * SLOTH, dt = total / (swings + 1);
        evInfo = "rock +/-" + amp.toFixed(1) + "deg scale(" + S.toFixed(3) + ")";
        vbox.style.transition = "transform " + Math.round(dt * 0.4) + "ms ease-in-out";
        vbox.style.transform = "rotate(0deg) scale(" + S.toFixed(3) + ")";
        let i = 0;
        const tick = () => {
          if (i >= swings) { vbox.style.transition = "transform " + Math.round(dt * 0.5) + "ms ease-in-out"; applyLook(false); return; }
          const a = (i % 2 === 0 ? 1 : -1) * amp;
          vbox.style.transition = "transform " + Math.round(dt) + "ms ease-in-out";
          vbox.style.transform = "rotate(" + a.toFixed(1) + "deg) scale(" + S.toFixed(3) + ")";
          i++; setTimeout(tick, dt);
        };
        setTimeout(tick, dt * 0.4 + 10);
        return Math.round(dt * 0.4 + swings * dt + dt * 0.5); } },
    stretch: { w: 3, mobile: true, run() {   // slow asymmetric STRETCH/SQUASH — scaleX & scaleY drift apart and back around a >=1 base, an anamorphic breath that never uncovers an edge (min axis stays >= 1)
        const base = 1.2, a = 1 + Math.min(.15, rnd(.06, .11) * (0.7 + 0.3 * DRAMA));   // base/a >= ~1.04
        const cycles = 2 + ((Math.random() * 2) | 0), total = (600 + Math.random() * 500) * SLOTH, dt = total / (cycles * 2 + 1);
        evInfo = "scaleX(" + (base * a).toFixed(3) + ") scaleY(" + (base / a).toFixed(3) + ")";
        vbox.style.transition = "transform " + Math.round(dt) + "ms ease-in-out";
        vbox.style.transform = "scale(" + base + ")";
        let i = 0;
        const tick = () => {
          if (i >= cycles * 2) { applyLook(false); return; }
          const wide = i % 2 === 0;
          vbox.style.transform = "scaleX(" + (wide ? base * a : base / a).toFixed(3) + ") scaleY(" + (wide ? base / a : base * a).toFixed(3) + ")";
          i++; setTimeout(tick, dt);
        };
        setTimeout(tick, 40);
        return cycles * 2 * dt + dt; } },
    breathe: { w: 3, mobile: true, run() {   // slow BREATHING barrel zoom — the frame inhales/exhales scale a few times, a continuous swell distinct from zoom's single pop (lo >= 1 so it always covers)
        const lo = 1.12, hi = Math.min(2.3, 1.45 + Math.random() * 0.5 * DRAMA), cycles = 2 + ((Math.random() * 2) | 0), total = (650 + Math.random() * 500) * SLOTH, dt = total / (cycles * 2 + 1);
        evInfo = "scale(" + lo.toFixed(2) + "<->" + hi.toFixed(2) + ")";
        vbox.style.transition = "transform " + Math.round(dt) + "ms ease-in-out";
        vbox.style.transform = "scale(" + lo + ")";
        let i = 0;
        const tick = () => {
          if (i >= cycles * 2) { applyLook(false); return; }
          vbox.style.transform = "scale(" + (i % 2 === 0 ? hi : lo).toFixed(3) + ")";
          i++; setTimeout(tick, dt);
        };
        setTimeout(tick, 40);
        return cycles * 2 * dt + dt; } },
    melt: { w: 4, mobile: true, run() {   // slow MELT — a skewY + downward drip creeping over a long time (blur creeps in on desktop). Scale is held constant for the whole creep and covers the shear+shift, so no edge ever opens
        const sk = (Math.random() < .5 ? -1 : 1) * rnd(4, 7) * (0.7 + 0.3 * DRAMA), ty = rnd(3, 7);
        const sc = 1.16 + Math.abs(sk) / 40 + ty / 100 * 2.4, dur = (800 + Math.random() * 600) * SLOTH, warm = 120 * SLOTH;
        evInfo = "skewY(" + sk.toFixed(1) + "deg) translateY(" + ty.toFixed(1) + "%) scale(" + sc.toFixed(3) + ")";
        vbox.style.transition = "transform " + Math.round(warm) + "ms ease-in-out";
        vbox.style.transform = "scale(" + sc.toFixed(3) + ")";   // scale up first (no skew yet -> covered), hold sc for the whole melt
        setTimeout(() => {
          vbox.style.transition = "transform " + Math.round(dur) + "ms cubic-bezier(.35,0,.2,1)";
          vbox.style.transform = "skewY(" + sk.toFixed(1) + "deg) translateY(" + ty.toFixed(1) + "%) scale(" + sc.toFixed(3) + ")";
          if (!MOBILE) { fxTrans("backdrop-filter " + Math.round(dur) + "ms ease,-webkit-backdrop-filter " + Math.round(dur) + "ms ease"); fxSet("blur(" + (1.1 * DRAMA).toFixed(1) + "px) brightness(.93)"); }
        }, warm + 10);
        setTimeout(() => { if (!MOBILE) fxClear(); vbox.style.transition = "transform " + Math.round(warm) + "ms ease-in-out"; applyLook(false); }, warm + dur + 20);
        return warm + dur + warm + 40; } },
    doubleexpose: { w: 3, mobile: false, run() {   // the ghost's big sibling: a long DOUBLE-EXPOSURE dissolve — two big-offset copies held via stacked drop-shadows, then a slow fade (fxlayer; drop-shadow doubles the layer -> desktop)
        const off = ((10 + Math.random() * 22) * (0.6 + 0.5 * DRAMA)) | 0, dur = (900 + Math.random() * 700) * SLOTH;
        fxTrans("backdrop-filter " + Math.round(dur * .3) + "ms ease,-webkit-backdrop-filter " + Math.round(dur * .3) + "ms ease");
        evInfo = "drop-shadow(" + off + "px " + ((off * .4) | 0) + "px 0 rgba(255,255,255,.26)) drop-shadow(" + (-off) + "px " + (-((off * .4) | 0)) + "px 0 rgba(150,200,255,.22))";
        fxSet(evInfo + " brightness(1.03)");
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, dur); return dur; } },
    // -- channel surfing --
    surf: { w: 2, mobile: false, can() { return !!pipEl && !!pickAlt(); }, run() {   // channel-surf PEEK. The cut in/out stays instant (a channel change IS a cut), but DWELL on the peeked channel ~10x longer
        const n = pickAlt(), src = n && srcFor(n); if (!src) return 300; setPip(pipEl, src, true);
        const dur = (500 + Math.random() * 1500) * SLOTH;
        clearTimeout(pipTimer); pipTimer = setTimeout(() => { setPip(pipEl, src, false); hidePip(); }, dur); return dur; } },
    // -- musical hit (fired by the bar clock's pulse on a section/downbeat) --
    tearhit: { w: 2, mobile: true, run() {   // a hard tape tear on the drop. NOT SLOTH'd on purpose: this is beat-LOCKED musical punctuation (fired by pulse() on section downbeats) — a 10x smear would desync it from the hit and stop reading as intentional. Stays sharp.
        const dur = 170 + Math.random() * 260; tear.style.transition = "opacity 30ms";
        tear.style.top = (18 + Math.random() * 54) + "%"; tear.style.opacity = ".95";
        setTimeout(() => { tear.style.opacity = "0"; }, dur); return dur; } },
  };
  const DECK = Object.keys(EV);

  // family bias: ambient/neoclassical (clean) go SPARSE-BUT-DEEPLY-WEIRD — pull
  // the alien/broadcast oddities up, push the frantic analog thrash down; glitch
  // leans into the thrash. Everything keeps some baseline weight.
  const WEIRD = new Set(["glyph", "subtitle", "dispstorm", "colorbars", "standby", "timestamp", "channelosd", "posterize",
    "lean", "melt", "breathe", "doubleexpose"]);   // the slow geological warps suit clean/ambient's "sparse but deeply weird"
  const FRANTIC = new Set(["hsync", "zoom", "mirror", "tracking", "vroll", "surf", "scanshift", "ghost", "pip"]);
  function weightFor(name) {
    let w = EV[name].w;
    if (curFam === "clean") { if (WEIRD.has(name)) w *= 2.1; if (FRANTIC.has(name)) w *= 0.35; }
    else if (curFam === "glitch") { if (FRANTIC.has(name)) w *= 1.4; }
    return w;
  }
  function eligible() {
    return DECK.filter(n => (!MOBILE || EV[n].mobile) && (!EV[n].can || EV[n].can()) && n !== "tearhit");
  }
  function drawEvent() {
    const pool = eligible().filter(n => n !== lastEvt);   // never the same event twice in a row
    if (!pool.length) return null;
    let tot = 0; const cum = [];
    for (const n of pool) { tot += weightFor(n); cum.push([tot, n]); }
    const r = Math.random() * tot;
    for (const [c, n] of cum) if (r <= c) return n;
    return pool[pool.length - 1];
  }
  function runNamed(name) {
    const e = EV[name]; if (!e) return 500;
    lastEvt = name;   // shared no-repeat across scheduler + musical pulse
    evInfo = "";
    let dur = 500; try { dur = e.run() || 500; } catch (err) {}
    clog(name, dur, evInfo); return dur;
  }
  function fireEvent() { const n = drawEvent(); return n ? runNamed(n) : 700; }

  // Poisson-ish scheduler with a random-walking "storm" scalar -> pronounced
  // bursts and lulls (not a metronome). Serial: the next event is scheduled
  // AFTER the current one's duration, so shared surfaces never overlap.
  function scheduleChaos() {
    clearTimeout(chaosTimer);
    if (!chaosOn || !ready || !on || reduced) return;
    storm *= Math.exp((Math.random() - 0.5) * 0.9); storm = Math.max(0.4, Math.min(2.4, storm));
    const ci = chaosIntensity(), base = (profile && profile.wgap || 5200) / (WACKADOODLE * (0.5 + ci));
    // bursts get likelier with storminess + chaos intensity
    if (Math.random() < 0.09 + 0.15 * ci * Math.min(1, storm / 2)) { burstRun(); return; }
    const dur = fireEvent();
    let gap = base * expRand() / storm;
    gap = Math.max(MOBILE ? 900 : 420, Math.min(26000, gap));
    chaosTimer = setTimeout(scheduleChaos, dur + gap);
  }
  function burstRun() {   // a flurry: several events close together, then a lull
    let i = 0; const n = 2 + ((Math.random() * 4) | 0);
    const step = () => {
      if (!chaosOn || !ready || !on || reduced) return;
      const dur = fireEvent(); i++;
      if (i < n) chaosTimer = setTimeout(step, dur + rnd(140, 520));
      else chaosTimer = setTimeout(scheduleChaos, dur + rnd(700, 1800));   // exhale after the burst
    };
    step();
  }
  function restartChaos() {
    clearTimeout(chaosTimer);
    if (chaosOn && ready && on && !reduced) chaosTimer = setTimeout(scheduleChaos, 1200 + Math.random() * 2600);
  }
  function startChaos() { chaosOn = true; storm = 1; lastEvt = ""; restartChaos(); }
  function stopChaos() {
    chaosOn = false; clearTimeout(chaosTimer); clearInterval(stormIv); clearInterval(tsIv);
    fxClear();
    [barsEl, cardEl, subEl, chanEl, tsEl, trackEl, ...glyphEls].forEach(el => { if (el) el.style.opacity = "0"; });
    if (vbox) { vbox.classList.remove("vl-roll"); applyLook(false); }   // drop any in-flight lean/warp back to the un-transformed base
    hidePip();
  }

  // musical hook: the bar clock reaches the layer once per bar (info.serial /
  // info.section). Align SOME events to the music — a tear on a section change
  // (a "drop") reads intentional; the async scheduler keeps the alien feel. Both
  // mixed. Uses overlay-safe events only, so it never collides with vbox.
  function pulse(info) {
    if (!chaosOn || !ready || !on || reduced || !info) return;
    const ci = chaosIntensity(), sectionChange = info.section && info.section !== lastSection;
    lastSection = info.section || lastSection;
    // honor the station-wide never-twice-in-a-row rule: if the coin lands on
    // what just fired (scheduler or pulse — lastEvt is shared), take the other.
    const coin = (a, b) => { const n = Math.random() < 0.5 ? a : b; return n === lastEvt ? (n === a ? b : a) : n; };
    if (sectionChange && Math.random() < 0.15 + 0.25 * ci) {
      runNamed(coin("tearhit", "tracking"));   // punctuate the section boundary (subtle — NOT colorbars: it was overshowing)
    } else if (Math.random() < 0.08 + 0.30 * ci) {
      runNamed(coin("tracking", MOBILE ? "scanshift" : "chroma"));   // occasional on-beat flavor (chroma = fxlayer, desktop)
    }
  }

  // ---------- clip resolution + streaming ----------
  function playable(name) {
    const e = catalog.get(name); if (!e) return false;
    return (online && e.item && e.file) || localAvail.has(name);
  }
  // ordered source candidates for a clip: LOCAL cache clip first (stop the live
  // app depending on archive.org — no remote request fires for anything cached),
  // remote archive.org stream only as a fallback for clips we don't have locally.
  function candidates(name) {
    const e = catalog.get(name); const out = [];
    if (localAvail.has(name)) out.push({ kind: "local", url: "found/video/" + name + ".mp4" });
    if (e && online && e.item && e.file && !localAvail.has(name))
      out.push({ kind: "remote", url: base + "/" + encodeURIComponent(e.item) + "/" + encodeURI(e.file), in: e.in || 0, out: e.out || 0 });
    return out;
  }
  function shortLabel(name) {
    const e = catalog.get(name);
    return (e && e.title) ? e.title.slice(0, 28) : name;
  }

  function clearHandlers(v) { v.oncanplay = null; v.onerror = null; v.onloadedmetadata = null; v.ontimeupdate = null; }
  // remote clips play a cue WINDOW [in,out] of a full reel: loop within it.
  function attachWindowLoop(v, cue) {
    if (!cue) { v.ontimeupdate = null; return; }
    v.ontimeupdate = () => {
      if (v.currentTime >= cue.out - 0.06 || v.currentTime < cue.in - 0.5) {
        try { v.currentTime = cue.in; } catch (e) {}
      }
    };
  }

  // The BACK element (the one not currently shown) is a preload/crossfade state
  // machine: prefetch(name) primes it while the front plays; show(name) either
  // crossfades immediately (if the back already reached that clip) or arms it to
  // crossfade the moment it does. Because the next clip buffers for a whole
  // 8-measure window before it's shown, remote archive.org streams have real time
  // to reach `canplay` — and if a stream still isn't ready (or errors) we fall
  // back to the local cache clip, and failing that HOLD the front (never black).
  let backLoad = null;       // { name, token, cands, i, cue, kind, ready, wantShow }
  let queuedPrefetch = null;  // a next-clip prefetch deferred until the pending show crossfades
  function backIndex() { return vids.length > 1 ? 1 - front : 0; }

  function loadBack(name, wantShow) {
    if (!ready || !on || !name) return;
    if (wantShow) queuedPrefetch = null;          // a real show supersedes any deferred prefetch
    if (name === curName) { if (backLoad && backLoad.name === name) backLoad = null; return; }
    if (vids.length < 2 && !wantShow) return;      // (defensive: every tier now has 2 — front + hidden loader)
    // there is ONE back element: don't let a prefetch clobber a show that's still
    // waiting to become ready — defer it until that show has crossfaded.
    if (!wantShow && backLoad && backLoad.wantShow && !backLoad.ready) { queuedPrefetch = name; return; }
    if (backLoad && backLoad.name === name) {       // already priming this clip
      backLoad.wantShow = backLoad.wantShow || !!wantShow;
      if (backLoad.ready && backLoad.wantShow) crossfadeBack(backLoad);
      else if (backLoad.wantShow && backLoad.expedite) backLoad.expedite();   // show wants it NOW: give remote 800ms more, then local
      return;
    }
    const cands = candidates(name);
    if (!cands.length) { console.log("[vid] no source for", name, "(holding)"); return; }
    backLoad = { name, token: ++seq, cands, i: -1, ready: false, wantShow: !!wantShow };
    nextCand(backLoad);
  }

  function nextCand(bl) {
    bl.i++;
    if (bl.token !== seq) return;
    if (bl.i >= bl.cands.length) { console.log("[vid] all sources failed for", bl.name, "(holding)"); return; }
    const c = bl.cands[bl.i];
    const v = vids[backIndex()];
    clearHandlers(v);
    bl.cue = c.kind === "remote" && c.out ? { in: c.in, out: c.out } : null;
    bl.kind = c.kind;
    let settled = false;
    v.oncanplay = () => {                          // readyState >= HAVE_FUTURE_DATA
      if (settled || bl.token !== seq) return; settled = true; clearTimeout(to);
      bl.ready = true;
      if (bl.wantShow) crossfadeBack(bl);
      else if (MOBILE) { try { v.pause(); } catch (e) {} }   // loader buffered -> hold it (no 2nd running decoder on the phone)
    };
    v.onerror = () => {
      if (settled || bl.token !== seq) return; settled = true; clearTimeout(to);
      console.log("[vid]", c.kind, "failed for", bl.name, "->", bl.i + 1 < bl.cands.length ? "fallback" : "hold");
      nextCand(bl);
    };
    // slow archive.org: after the budget, drop to the local cache clip if there
    // is one; otherwise keep waiting (canplay may still land) — never black.
    // Prefetches get the long budget (the whole point of loading ahead).
    const budget = c.kind === "remote" ? (bl.wantShow ? REMOTE_READY_MS : PREFETCH_REMOTE_MS) : LOCAL_READY_MS;
    let to = setTimeout(() => {
      if (settled) return;
      if (bl.i + 1 < bl.cands.length) { settled = true; nextCand(bl); }
    }, budget);
    bl.expedite = () => {                            // a deferred show arrived mid-prefetch
      if (settled || c.kind !== "remote" || bl.i + 1 >= bl.cands.length) return;
      clearTimeout(to);
      to = setTimeout(() => { if (!settled) { settled = true; nextCand(bl); } }, 800);
    };
    v.loop = c.kind === "local";                   // local = pre-cut -> native loop; remote loops its window
    const frag = bl.cue ? "#t=" + bl.cue.in : (c.kind === "remote" && c.in ? "#t=" + c.in : "");
    v.src = c.url + frag;
    v.playbackRate = RATE;
    try { v.load(); } catch (e) {}
    v.play().catch(() => {});                       // muted: allowed, and buffers the window ahead
  }

  function crossfadeBack(bl) {
    if (bl.token !== seq) return;
    const back = backIndex(), vNew = vids[back], vOld = vids[front];
    vNew.playbackRate = RATE;
    if (bl.cue) { if (vNew.currentTime < bl.cue.in - 0.2 || vNew.currentTime > bl.cue.out) { try { vNew.currentTime = bl.cue.in; } catch (e) {} } }
    else if (bl.kind === "local" && isFinite(vNew.duration) && vNew.duration > 6) {
      try { vNew.currentTime = Math.random() * (vNew.duration - 3); } catch (e) {}   // vary the local loop start
    }
    attachWindowLoop(vNew, bl.cue);
    vNew.play().catch(() => {});
    flashOsd("▶ " + pick(GLYPHS));   // glyph ident, not the (English) archive title — no English on the broadcast
    burst();                                        // every switch tears a little
    vNew.style.opacity = "1";
    if (vOld !== vNew) {
      vOld.style.opacity = "0";
      setTimeout(() => { try { vOld.pause(); } catch (e) {} clearHandlers(vOld); }, FADE_MS + 120);
    }
    front = back; curName = bl.name; backLoad = null;
    if (queuedPrefetch) { const q = queuedPrefetch; queuedPrefetch = null; loadBack(q, false); }   // the back element is free now
  }

  // start buffering the next clip on the back element (no crossfade yet)
  function prefetch(name) { loadBack(name, false); }
  // show now: crossfade as soon as the clip is ready (immediately if prefetched)
  function show(name) { loadBack(name, true); }

  function stopIdle() { clearTimeout(idleTimer); idleTimer = 0; }
  function idle() {
    stopIdle();
    if (!ready || !on || reduced) return;
    idleTimer = setTimeout(() => { const n = nextCatalog(); if (n) show(n); idle(); }, IDLE_CYCLE_MS);
  }

  function setEnabled(want) {
    want = !!want;
    // IDEMPOTENT: the background program imposes its desired state on EVERY store
    // render, so bail unless the on-state or the materialized DOM actually needs
    // to change (no idle/glitch/chaos timer churn). The DOM check also self-heals
    // the stranded case: setEnabled(true) requested BEFORE init built the wrap
    // records on=true; init's closing setEnabled(on) then materializes it.
    const shown = wrap ? wrap.style.display !== "none" : null;
    if (on === want && (shown === null || shown === want)) return;
    on = want;
    if (!wrap) return;
    wrap.style.display = on ? "block" : "none";
    if (on) {
      if (!curName) { const n = nextCatalog(); if (n) show(n); }
      else vids[front].play().catch(() => {});
      idle(); glitchLoop(); startChaos();
    } else {
      stopIdle(); clearTimeout(glitchTimer); stopChaos();
      backLoad = null; queuedPrefetch = null; ++seq;   // drop any in-flight preload
      vids.forEach(v => { try { v.pause(); } catch (e) {} });
    }
  }

  async function init() {
    online = navigator.onLine !== false;
    let cat = null, localList = null;
    try { const r = await fetch("found/video/stream-catalog.json", { cache: "no-cache" }); if (r.ok) cat = await r.json(); } catch (e) {}
    try { const r = await fetch("found/video/clips.json", { cache: "no-cache" }); if (r.ok) localList = await r.json(); } catch (e) {}
    localAvail = new Set((localList || []).map(c => c && c.file && c.file.replace(/\.mp4$/, "")).filter(Boolean));
    base = (cat && cat.base) || base;
    catalog = new Map();
    tagIndex = new Map();
    if (cat && Array.isArray(cat.clips)) {
      for (const e of cat.clips) if (e && e.name) {
        catalog.set(e.name, e);
        for (const t of (e.tags || [])) { if (!tagIndex.has(t)) tagIndex.set(t, []); tagIndex.get(t).push(e.name); }
      }
    }
    // no stream catalog -> synthesize a local-only catalog from clips.json (the
    // legacy/offline path: everything plays from the local cache)
    if (!catalog.size && localList) {
      for (const c of localList) { if (!c || !c.file) continue; const n = c.file.replace(/\.mp4$/, ""); catalog.set(n, { name: n, item: null, file: null, credit: c.credit, local: true, tags: [] }); }
    }
    if (!catalog.size) return false;
    names = [...catalog.keys()].filter(playable);
    // if nothing is playable (online but archive somehow unreachable AND no local
    // cache), still expose local-only names so a later retry / cache works
    if (!names.length) names = [...catalog.keys()].filter(n => localAvail.has(n));
    if (!names.length) return false;
    makeDom();
    ready = true;
    // DEFAULT OFF (Paul 2026-07-08), and NO self-restore: `on` is whatever the
    // background program has requested so far (false until asked). Materialize
    // it — if the controller asked for video while we were still loading, the
    // wrap lights up now; otherwise this is a no-op and the layer stays dark.
    setEnabled(on);
    return true;
  }

  root.VideoLayer = {
    // catalog-tag lookup: the streaming catalog carries genre tags directly
    // (the sourced avant-garde/3D windows exist ONLY here — the kernel's
    // GENRE_CLIPS never learns them), so pool builders must union this in.
    namesForTag: (g) => (tagIndex.get(g) || []).filter(playable),
    allNames: () => names.slice(),   // the WHOLE playable catalog — pool builders top up from this so clips don't recycle
    init, setEnabled, idle, makeBag, setGenre,
    enabled: () => on && ready,
    available: () => ready,
    // VIDEO EXPORT (E): the front <video> element for canvas compositing. Clips
    // are LOCAL (found/video/*.mp4, same-origin) so drawImage doesn't taint the
    // capture canvas; returns null if nothing's playing. `_localBase` (unused here)
    // documents the local-first source.
    _frontEl: () => vids[front] || null,
    onSection: (idx) => { stopIdle(); const n = names[((idx % names.length) + names.length) % names.length]; if (n) show(n); },
    showFile: (file) => { stopIdle(); show(String(file).replace(/\.mp4$/, "")); },
    prefetch: (file) => { if (file) prefetch(String(file).replace(/\.mp4$/, "")); },
    credits: () => [...catalog.values()].map(e => ({ file: e.name + ".mp4", credit: e.credit })),
    // ALIEN BROADCAST: the bar clock feeds this per bar for musical alignment.
    pulse,
    // gate/debug hooks: read the event log; force-fire a named event for capture.
    _chaosLog: () => chaosLog.slice(),
    _chaosDeck: () => DECK.slice(),
    _chaosFire: (name) => runNamed(name),
    _chaosEnabled: (v) => { if (v) startChaos(); else stopChaos(); },   // gate harness: quiesce the scheduler to capture one event in isolation
  };
})(window);
