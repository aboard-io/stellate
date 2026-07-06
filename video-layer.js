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
//   VideoLayer.setEnabled(on)    -> show/hide (persisted in localStorage)
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
  const FADE_MS = MOBILE ? 0 : 1600;   // phones: hard cuts — a second decoder + crossfade janks touch
  const IDLE_CYCLE_MS = 24000;   // ambient switch period when nothing is playing
  const RATE = 0.5;              // slowed playback — dreamier, more VHS
  const LS_KEY = "vaporwave-video-on";
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
  let osd = null, osdTimer = 0, glitchTimer = 0, idleTimer = 0, on = true, ready = false;
  let grain = null, dispEl = null, roEl = null, gbEl = null;   // SVG glitch knobs
  let curName = null, seq = 0, curGenre = "", profile = null;
  // ---- ALIEN BROADCAST chaos-layer state (event-driven station personality) --
  let fxlayer = null, pipEl = null, barsEl = null, cardEl = null, subEl = null,
      chanEl = null, glyphEl = null, tsEl = null, trackEl = null,
      stormDisp = null, stormTurb = null;
  let chaosTimer = 0, chaosOn = false, lastEvt = "", storm = 1, curFam = "vhs", lastSection = null;
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
    vbox.style.cssText = "position:absolute;inset:0;transition:filter 850ms ease,transform 850ms ease";
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
      v.playbackRate = RATE;
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
    fxlayer.style.cssText = "position:absolute;inset:0;pointer-events:none;transition:backdrop-filter 120ms ease,-webkit-backdrop-filter 120ms ease";
    wrap.appendChild(fxlayer);
    // readability veil + VHS scanlines + jittering grain over the footage, under the UI
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;" +
      "background:linear-gradient(rgba(12,10,26,.44),rgba(12,10,26,.26) 30%,rgba(12,10,26,.5))";
    scan = document.createElement("div");
    scan.style.cssText = "position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;transition:opacity .3s,background-size .3s;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 1px,transparent 1px 3px)";
    grain = document.createElement("div");
    if (MOBILE) grain.setAttribute("hidden", "");
    grain.style.cssText = "position:absolute;inset:-220px;opacity:.12;mix-blend-mode:screen;transition:opacity .8s;" +
      "background-image:" + NOISE_URI + ";animation:vhsgrain .42s steps(2) infinite";
    tear = document.createElement("div");
    tear.style.cssText = "position:absolute;left:-2%;right:-2%;height:16px;top:40%;opacity:0;" +
      "mix-blend-mode:screen;transition:opacity .06s;" +
      "background:linear-gradient(rgba(255,255,255,.22),rgba(140,255,255,.12) 60%,transparent)";
    osd = document.createElement("div");
    osd.style.cssText = "position:absolute;top:16px;left:22px;opacity:0;transition:opacity .25s;" +
      "font:26px 'VT323',ui-monospace,Menlo,monospace;color:rgba(235,255,240,.45);" +
      "letter-spacing:.06em;text-shadow:2px 2px 0 rgba(0,0,0,.35)";
    const st = document.createElement("style");
    st.textContent = "@keyframes vhsgrain{0%{transform:translate(0,0)}25%{transform:translate(-70px,40px)}" +
      "50%{transform:translate(45px,-90px)}75%{transform:translate(-30px,-35px)}100%{transform:translate(60px,70px)}}" +
      // vertical-hold roll: scale(1.14) overscan hides the reveal so the roll
      // never exposes black (the never-black law extends to never-black-edges).
      "@keyframes vl-roll{0%{transform:scale(1.14) translateY(-7%)}50%{transform:scale(1.14) translateY(7%)}100%{transform:scale(1.14) translateY(-7%)}}" +
      ".vl-roll{animation:vl-roll .52s linear 2}";
    // ---- ALIEN BROADCAST furniture (dedicated overlay els; opacity-toggled,
    // never touch vbox — all cheap compositor paints over the base grade) ----
    barsEl = document.createElement("div");   // SMPTE-ish color-bar interstitial — DIM (haunted, not a reference chart)
    barsEl.style.cssText = "position:absolute;inset:0;opacity:0;transition:opacity .09s;filter:brightness(.5) saturate(.72);background:linear-gradient(90deg," +
      "#c0c0c0 0 14.28%,#c0c000 0 28.57%,#00c0c0 0 42.85%,#00c000 0 57.14%,#c000c0 0 71.42%,#c00000 0 85.71%,#2030c0 0 100%)";
    cardEl = document.createElement("div");   // big centered interstitial card (glyph standby)
    cardEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;" +
      "transition:opacity .12s;background:rgba(6,6,16,.55);color:#eafff0;text-align:center;padding:0 6%;" +
      "font:700 clamp(20px,5vw,54px) 'VT323',ui-monospace,monospace;letter-spacing:.14em;text-shadow:0 0 12px rgba(120,255,200,.45)";
    subEl = document.createElement("div");    // wrong captions of the music
    subEl.style.cssText = "position:absolute;left:0;right:0;bottom:8%;text-align:center;opacity:0;transition:opacity .18s;" +
      "font:26px 'VT323',ui-monospace,monospace;color:#f4fff8;letter-spacing:.08em;text-shadow:2px 2px 0 rgba(0,0,0,.6);" +
      "background:linear-gradient(transparent,rgba(0,0,0,.35),transparent)";
    chanEl = document.createElement("div");   // channel-number OSD (wrong/alien/huge)
    chanEl.style.cssText = "position:absolute;top:14px;right:20px;opacity:0;font:30px 'VT323',ui-monospace,monospace;" +
      "color:rgba(255,240,170,.9);letter-spacing:.05em;text-shadow:0 0 8px rgba(255,200,80,.55)";
    glyphEl = document.createElement("div");  // alien station idents
    glyphEl.style.cssText = "position:absolute;top:42%;right:8%;opacity:0;font:48px 'VT323',ui-monospace,monospace;" +
      "color:rgba(210,255,250,.72);text-shadow:0 0 14px rgba(120,255,255,.5)";
    tsEl = document.createElement("div");     // timestamp OSD (backwards / base-13)
    tsEl.style.cssText = "position:absolute;bottom:84px;right:20px;opacity:0;transition:opacity .2s;" +   // above the explorer's corner buttons (chrome overlays this layer)
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
    vbox.append(trackEl, barsEl, glyphEl, chanEl, tsEl, subEl, cardEl);
    wrap.append(veil, scan, grain, tear, osd, st);
    if (!MOBILE) {   // PiP / channel-surf peek: one extra decoder, desktop only
      pipEl = document.createElement("video");
      pipEl.muted = true; pipEl.loop = true; pipEl.playsInline = true; pipEl.preload = "auto";
      pipEl.setAttribute("muted", ""); pipEl.setAttribute("playsinline", "");
      pipEl.style.cssText = "position:absolute;right:4.5%;bottom:6%;width:30%;height:30%;object-fit:cover;opacity:0;" +
        "transition:opacity .18s;border:2px solid rgba(210,255,235,.5);border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,.5)";
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
    if (immediate) { void vbox.offsetWidth; vbox.style.transition = "filter 850ms ease,transform 850ms ease"; }
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
    osdTimer = setTimeout(() => { osd.style.opacity = "0"; }, 1900);
  }

  // one tape wobble: color/blur glide out and back, tear band drifts. Intensity
  // scales with the genre profile; glitch-family bursts also kick the SVG
  // RGB-split displacement (idm/darksynth/breakcore tear hard; ambient barely).
  function burst() {
    if (!ready || !on || reduced || !vbox || !profile) return;   // mobile too: transform+filter wobble is compositor-cheap
    const g = profile.glitch;
    const dx = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 6) * (0.5 + g);
    const dur = 900 + Math.random() * 700;
    vbox.style.transition = "filter " + (dur / 2) + "ms ease-in-out, transform " + (dur / 2) + "ms ease-in-out";
    vbox.style.filter = baseFilterStr() + " saturate(" + (1.2 + g) + ") hue-rotate(" + (((Math.random() * 50 - 25) * g) | 0) + "deg) blur(" + (0.6 + g) + "px)";
    vbox.style.transform = "translateX(" + dx + "px) scaleY(" + (1 + .02 * g) + ")";
    if (profile.svg && dispEl && !MOBILE) {   // SVG RGB-split is desktop-only (not in the mobile base grade)
      const scale = (10 + Math.random() * 26) * g, off = (2 + Math.random() * 5) * g;
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
    const period = (profile ? profile.tear : 6000);
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

  const nowMs = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const expRand = () => -Math.log(1 - Math.random());   // mean 1, memoryless -> natural clustering
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function clog(type, dur) {
    chaosLog.push({ type, t: Math.round(nowMs()), dur: Math.round(dur) });
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
  function flickerEl(el, dur) {
    if (!el) return;
    el.style.opacity = "1";
    const end = nowMs() + dur;
    const blink = () => {
      if (nowMs() >= end) { el.style.opacity = "0"; return; }
      el.style.opacity = Math.random() < .22 ? "0.12" : (Math.random() < .5 ? "1" : "0.72");
      setTimeout(blink, 55 + Math.random() * 150);
    };
    setTimeout(blink, 50);
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
    vroll: { w: 6, mobile: true, run() {   // vertical-hold roll (overscan hides black) — transform, cheap on phones
        vbox.style.transition = "none"; vbox.classList.add("vl-roll");
        const dur = 1040; setTimeout(() => { vbox.classList.remove("vl-roll"); applyLook(false); }, dur); return dur; } },
    hsync: { w: 7, mobile: true, run() {   // h-sync tear: skew jolts — transform, cheap on phones
        const g = chaosIntensity(), n = 3 + ((Math.random() * 4) | 0), dt = 42 + Math.random() * 44;
        vbox.style.transition = "transform 28ms linear";
        for (let i = 0; i < n; i++) setTimeout(() => {
          const sk = (Math.random() * 26 - 13) * (0.5 + g);
          vbox.style.transform = "skewX(" + sk.toFixed(1) + "deg) translateX(" + (sk | 0) + "px) scale(1.06)";
        }, i * dt);
        const dur = n * dt + 40; setTimeout(() => applyLook(false), dur); return dur; } },
    tracking: { w: 6, mobile: true, run() {   // tracking-noise band sweeps the frame
        const dur = 480 + Math.random() * 720;
        trackEl.style.transition = "none"; trackEl.style.top = "-12%"; trackEl.style.opacity = ".85";
        void trackEl.offsetWidth;
        trackEl.style.transition = "top " + dur + "ms linear, opacity " + dur + "ms ease-in";
        trackEl.style.top = "108%"; setTimeout(() => { trackEl.style.opacity = "0"; }, dur * 0.95);
        return dur; } },
    chroma: { w: 7, mobile: true, run() {   // chroma drift: hue-rotate lurch (fxlayer desktop / vbox filter mobile)
        const g = chaosIntensity(), dur = 280 + Math.random() * 540;
        const deg = ((60 + Math.random() * 220) * (0.5 + g)) * (Math.random() < .5 ? -1 : 1);
        fxTrans("backdrop-filter " + (dur * .4) + "ms ease,-webkit-backdrop-filter " + (dur * .4) + "ms ease");
        fxSet("hue-rotate(" + (deg | 0) + "deg) saturate(" + (1.4 + g).toFixed(2) + ")");
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, dur); return dur; } },
    ghost: { w: 5, mobile: false, run() {   // ghosting: offset RGB drop-shadow doubles (fxlayer)
        const g = chaosIntensity(), off = ((4 + Math.random() * 11) * (0.6 + g)) | 0, dur = 340 + Math.random() * 720;
        fxTrans("none");
        fxSet("drop-shadow(" + off + "px 0 0 rgba(255,60,90,.5)) drop-shadow(" + (-off) + "px 0 0 rgba(60,180,255,.5)) blur(.3px)");
        clearTimeout(fxTimer); fxTimer = setTimeout(fxClear, dur); return dur; } },
    pump: { w: 5, mobile: true, run() {   // brightness pumping (fxlayer desktop / vbox filter mobile, stepped)
        const g = chaosIntensity(), seq = [1.6 + g, 0.55, 1.4 + g * .5, 0.8, 1], dt = 105;
        fxTrans("none");
        seq.forEach((b, i) => setTimeout(() => fxSet("brightness(" + b.toFixed(2) + ") contrast(" + (1 + .3 * g).toFixed(2) + ")"), i * dt));
        const dur = seq.length * dt + 40; setTimeout(fxClear, dur); return dur; } },
    invert: { w: 4, mobile: true, run() {   // invert blink (fxlayer desktop / vbox filter mobile)
        const n = 2 + ((Math.random() * 3) | 0), dt = 66 + Math.random() * 60; fxTrans("none");
        for (let i = 0; i < n; i++) { setTimeout(() => fxSet("invert(1) hue-rotate(180deg)"), i * 2 * dt); setTimeout(fxClear, (i * 2 + 1) * dt); }
        return n * 2 * dt; } },
    posterize: { w: 4, mobile: true, run() {   // posterize blink (SVG filter via fxlayer desktop / vbox filter mobile)
        const n = 1 + ((Math.random() * 2) | 0), dt = 120 + Math.random() * 150; fxTrans("none");
        for (let i = 0; i < n; i++) { setTimeout(() => fxSet("url(#vlposter) saturate(1.5)"), i * 2 * dt); setTimeout(fxClear, (i * 2 + 1) * dt); }
        return n * 2 * dt; } },
    scanshift: { w: 5, mobile: true, run() {   // scanline density + brightness shift
        const dur = 380 + Math.random() * 700;
        scan.style.backgroundSize = "100% " + (2 + Math.random() * 8 | 0) + "px";
        scan.style.opacity = (0.35 + Math.random() * 0.3).toFixed(2);
        setTimeout(() => { scan.style.backgroundSize = ""; scan.style.opacity = ".22"; }, dur); return dur; } },
    // -- broadcast furniture --
    colorbars: { w: 1, mobile: true, run() {   // SMPTE-ish interstitial — RARE, brief, DIM (Paul: was blasting the room)
        const long = Math.random() < .05, dur = long ? rnd(1300, 2200) : rnd(150, 420);
        barsEl.style.opacity = long ? "0.6" : "0.66";   // wash, not a full-brightness reference chart
        clearTimeout(barsTimer); barsTimer = setTimeout(() => { barsEl.style.opacity = "0"; }, dur); return dur; } },
    standby: { w: 2, mobile: true, run() {   // glyph interstitial card (rare 3-5s)
        cardEl.textContent = pick(STANDBY);
        const long = Math.random() < .18, dur = long ? rnd(3000, 5000) : rnd(600, 1500);
        cardEl.style.opacity = "1";
        clearTimeout(cardTimer); cardTimer = setTimeout(() => { cardEl.style.opacity = "0"; }, dur); return dur; } },
    channelosd: { w: 6, mobile: true, run() {   // channel number OSD, flickering
        chanEl.textContent = pick(CHAN); const dur = 500 + Math.random() * 1500; flickerEl(chanEl, dur); return dur; } },
    timestamp: { w: 4, mobile: true, run() {   // backwards / base-13 clock OSD
        const dur = 900 + Math.random() * 1700, back = Math.random() < .6; let v = (Math.random() * 20000) | 0;
        tsEl.style.opacity = ".8"; clearInterval(tsIv);
        tsIv = setInterval(() => { v += back ? -7 : 11; tsEl.textContent = fmtTS(v); }, 120);
        clearTimeout(tsTimer); tsTimer = setTimeout(() => { clearInterval(tsIv); tsEl.style.opacity = "0"; }, dur); return dur; } },
    // -- alien intelligence --
    glyph: { w: 7, mobile: true, run() {   // fleeting station ident
        glyphEl.textContent = pick(GLYPHS); const dur = 350 + Math.random() * 900; flickerEl(glyphEl, dur); return dur; } },
    subtitle: { w: 6, mobile: true, run() {   // captions the music wrongly
        subEl.textContent = pick(SUBS); const dur = 1200 + Math.random() * 1900;
        subEl.style.opacity = "1"; clearTimeout(subTimer); subTimer = setTimeout(() => { subEl.style.opacity = "0"; }, dur); return dur; } },
    pip: { w: 4, mobile: false, can() { return !!pipEl && !!pickAlt(); }, run() {   // picture-in-picture of ANOTHER clip
        const n = pickAlt(), src = n && srcFor(n); if (!src) return 300; setPip(pipEl, src, false);
        const dur = 1400 + Math.random() * 2600; clearTimeout(pipTimer); pipTimer = setTimeout(hidePip, dur); return dur; } },
    zoom: { w: 6, mobile: true, run() {   // sudden zoom lurch: snap in, drift back — transform, cheap on phones
        const sc = 1.7 + Math.random() * 1.1, dur = 700 + Math.random() * 900;
        vbox.style.transition = "transform 60ms ease-out"; vbox.style.transform = "scale(" + sc.toFixed(2) + ")";
        setTimeout(() => { vbox.style.transition = "transform " + dur + "ms cubic-bezier(.2,.7,.2,1)"; vbox.style.transform = "none"; }, 70);
        setTimeout(() => applyLook(false), dur + 140); return dur; } },
    mirror: { w: 5, mobile: true, run() {   // mirror / flip flash — transform, cheap on phones
        const flip = Math.random() < .5 ? "scaleX(-1)" : "scaleY(-1)", dur = 120 + Math.random() * 520;
        vbox.style.transition = "none"; vbox.style.transform = flip + " scale(1.02)";
        setTimeout(() => applyLook(false), dur); return dur; } },
    dispstorm: { w: 5, mobile: false, run() {   // feTurbulence displacement storm (SVG via fxlayer)
        const g = chaosIntensity(), dur = 700 + Math.random() * 1200; fxTrans("none"); fxSet("url(#vlstorm) contrast(1.08)");
        const end = nowMs() + dur; clearInterval(stormIv);
        stormIv = setInterval(() => {
          if (nowMs() >= end) { clearInterval(stormIv); fxClear(); if (stormDisp) stormDisp.setAttribute("scale", "0"); return; }
          if (stormDisp) stormDisp.setAttribute("scale", (((20 + Math.random() * 90) * (0.5 + g)) | 0).toFixed(0));
          if (stormTurb) stormTurb.setAttribute("seed", String((Math.random() * 9999) | 0));
        }, 90); return dur; } },
    // -- channel surfing --
    surf: { w: 2, mobile: false, can() { return !!pipEl && !!pickAlt(); }, run() {   // hard CUT to a random clip, then back (a PEEK, not a switch: never touches the bag state)
        const n = pickAlt(), src = n && srcFor(n); if (!src) return 300; setPip(pipEl, src, true);
        const dur = 500 + Math.random() * 1500;
        clearTimeout(pipTimer); pipTimer = setTimeout(() => { setPip(pipEl, src, false); hidePip(); }, dur); return dur; } },
    // -- musical hit (fired by the bar clock's pulse on a section/downbeat) --
    tearhit: { w: 2, mobile: true, run() {   // a hard tape tear that reads as intentional on the drop
        const dur = 170 + Math.random() * 260; tear.style.transition = "opacity 30ms";
        tear.style.top = (18 + Math.random() * 54) + "%"; tear.style.opacity = ".95";
        setTimeout(() => { tear.style.opacity = "0"; }, dur); return dur; } },
  };
  const DECK = Object.keys(EV);

  // family bias: ambient/neoclassical (clean) go SPARSE-BUT-DEEPLY-WEIRD — pull
  // the alien/broadcast oddities up, push the frantic analog thrash down; glitch
  // leans into the thrash. Everything keeps some baseline weight.
  const WEIRD = new Set(["glyph", "subtitle", "dispstorm", "colorbars", "standby", "timestamp", "channelosd", "posterize"]);
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
    let dur = 500; try { dur = e.run() || 500; } catch (err) {}
    clog(name, dur); return dur;
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
    [barsEl, cardEl, subEl, chanEl, glyphEl, tsEl, trackEl].forEach(el => { if (el) el.style.opacity = "0"; });
    if (vbox) vbox.classList.remove("vl-roll");
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
  // ordered source candidates for a clip: remote stream first (when online),
  // local cache clip as the slow-network / failure fallback.
  function candidates(name) {
    const e = catalog.get(name); const out = [];
    if (e && online && e.item && e.file)
      out.push({ kind: "remote", url: base + "/" + encodeURIComponent(e.item) + "/" + encodeURI(e.file), in: e.in || 0, out: e.out || 0 });
    if (localAvail.has(name)) out.push({ kind: "local", url: "found/video/" + name + ".mp4" });
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
    on = !!want;
    try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch (e) {}
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
    let saved = null; try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    setEnabled(saved == null ? !reduced : saved === "1");
    return true;
  }

  root.VideoLayer = {
    // catalog-tag lookup: the streaming catalog carries genre tags directly
    // (the sourced avant-garde/3D windows exist ONLY here — the kernel's
    // GENRE_CLIPS never learns them), so pool builders must union this in.
    namesForTag: (g) => (tagIndex.get(g) || []).filter(playable),
    init, setEnabled, idle, makeBag, setGenre,
    enabled: () => on && ready,
    available: () => ready,
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
  };
})(window);
